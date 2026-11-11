import { expect, it } from 'vitest';
import type {
    AvailableUpdate,
    UpdateDialogs,
    UpdateHost,
    UpdateSource,
    UpdateState,
} from './application-updates.service.js';
import { ApplicationUpdates } from './application-updates.service.js';

const update: AvailableUpdate = { version: '2.0.1', releasePage: 'https://example.test/v2.0.1' };

type Journal = string[];

interface Script {
    integratedInstall?: boolean;
    checks?: (AvailableUpdate | null | Error)[];
    downloads?: (Error | null)[];
    backups?: (Error | null)[];
    answers?: Partial<Record<keyof UpdateDialogs, boolean[]>>;
}

function updates(script: Script = {}) {
    const journal: Journal = [];
    const states: UpdateState['kind'][] = [];
    const checks = [...(script.checks ?? [update])];
    const downloads = [...(script.downloads ?? [])];
    const backups = [...(script.backups ?? [])];
    const answer = (name: keyof UpdateDialogs, detail = '') => {
        journal.push('dialog ' + name + (detail ? ' ' + detail : ''));

        return Promise.resolve(script.answers?.[name]?.shift() ?? true);
    };
    const fail = (outcome: Error | null | undefined) => {
        if (outcome) {
            throw outcome;
        }
    };
    const source: UpdateSource = {
        integratedInstall: script.integratedInstall ?? true,
        check: async () => {
            journal.push('check');
            const outcome = checks.shift() ?? null;

            if (outcome instanceof Error) {
                throw outcome;
            }

            return outcome;
        },
        download: async () => {
            journal.push('download');
            fail(downloads.shift());
        },
        install: () => {
            journal.push('install');
        },
    };
    const dialogs: UpdateDialogs = {
        upToDate: async () => {
            journal.push('dialog upToDate');
        },
        available: (offered, integrated) =>
            answer('available', offered.version + (integrated ? ' windows' : ' linux')),
        checkFailed: (message) => answer('checkFailed', message),
        downloadFailed: (_offered, message) => answer('downloadFailed', message),
        ready: (offered) => answer('ready', offered.version),
        backupFailed: (message) => answer('backupFailed', message),
    };
    const host: UpdateHost = {
        stopServer: async () => {
            journal.push('stop server');
        },
        backup: async (offered) => {
            journal.push('backup ' + offered.version);
            fail(backups.shift());
        },
        startServer: async () => {
            journal.push('start server');
        },
        openPage: async (address) => {
            journal.push('open ' + address);
        },
    };
    const service = new ApplicationUpdates(source, dialogs, host, (state) =>
        states.push(state.kind),
    );

    return { service, journal, states };
}

it('says the version is the latest after a manual check', async () => {
    const { service, journal } = updates({ checks: [null] });

    await service.chooseFromMenu();

    expect(journal).toEqual(['check', 'dialog upToDate']);
});
it('offers Retry when a manual check fails, then checks again', async () => {
    const { service, journal } = updates({ checks: [new Error('offline'), null] });

    await service.chooseFromMenu();

    expect(journal).toEqual(['check', 'dialog checkFailed offline', 'check', 'dialog upToDate']);
});
it('stops after a failed manual check when Close is chosen', async () => {
    const { service, journal } = updates({
        checks: [new Error('offline')],
        answers: { checkFailed: [false] },
    });

    await service.chooseFromMenu();

    expect(journal).toEqual(['check', 'dialog checkFailed offline']);
});
it('stays silent at startup when the version is the latest', async () => {
    const { service, journal } = updates({ checks: [null] });

    await service.checkAtStartup();

    expect(journal).toEqual(['check']);
});
it('stays silent at startup when the check fails', async () => {
    const { service, journal } = updates({ checks: [new Error('offline')] });

    await service.checkAtStartup();

    expect(journal).toEqual(['check']);
});
it('offers an update found at startup', async () => {
    const { service, journal } = updates({ answers: { available: [false] } });

    await service.checkAtStartup();

    expect(journal).toEqual(['check', 'dialog available 2.0.1 windows']);
});
it('offers an update at most once per start', async () => {
    const { service, journal } = updates({
        checks: [update, update],
        answers: { available: [false] },
    });

    await service.chooseFromMenu();

    await service.checkAtStartup();

    expect(journal).toEqual(['check', 'dialog available 2.0.1 windows', 'check']);
});
it('downloads nothing when Later is chosen', async () => {
    const { service, journal } = updates({ answers: { available: [false] } });

    await service.chooseFromMenu();

    expect(journal).not.toContain('download');
});
it('makes the backup with the server stopped before installing on Windows', async () => {
    const { service, journal } = updates();

    await service.chooseFromMenu();

    expect(journal).toEqual([
        'check',
        'dialog available 2.0.1 windows',
        'download',
        'dialog ready 2.0.1',
        'stop server',
        'backup 2.0.1',
        'install',
    ]);
});
it('moves through checking, downloading and ready', async () => {
    const { service, states } = updates({ answers: { ready: [false] } });

    await service.chooseFromMenu();

    expect(states).toEqual(['checking', 'idle', 'downloading', 'ready']);
});
it('keeps a downloaded update ready when Later is chosen', async () => {
    const { service, journal } = updates({ answers: { ready: [false] } });

    await service.chooseFromMenu();

    expect(service.current()).toEqual({ kind: 'ready', update });
    expect(journal).not.toContain('stop server');
});
it('installs a postponed update from the menu without a new check', async () => {
    const { service, journal } = updates({ answers: { ready: [false, true] } });

    await service.chooseFromMenu();
    journal.length = 0;

    await service.chooseFromMenu();

    expect(journal).toEqual(['dialog ready 2.0.1', 'stop server', 'backup 2.0.1', 'install']);
});
it('offers Retry when the download fails', async () => {
    const { service, journal } = updates({
        downloads: [new Error('connection lost')],
        answers: { ready: [false] },
    });

    await service.chooseFromMenu();

    expect(journal).toEqual([
        'check',
        'dialog available 2.0.1 windows',
        'download',
        'dialog downloadFailed connection lost',
        'download',
        'dialog ready 2.0.1',
    ]);
});
it('returns to the first state when a failed download is closed', async () => {
    const { service } = updates({
        downloads: [new Error('connection lost')],
        answers: { downloadFailed: [false] },
    });

    await service.chooseFromMenu();

    expect(service.current()).toEqual({ kind: 'idle' });
});
it('retries a failed backup and installs once it is saved', async () => {
    const { service, journal } = updates({ backups: [new Error('disk full')] });

    await service.chooseFromMenu();

    expect(journal.slice(-5)).toEqual([
        'stop server',
        'backup 2.0.1',
        'dialog backupFailed disk full',
        'backup 2.0.1',
        'install',
    ]);
});
it('installs nothing and starts the server again when a failed backup is cancelled', async () => {
    const { service, journal } = updates({
        backups: [new Error('disk full')],
        answers: { backupFailed: [false] },
    });

    await service.chooseFromMenu();

    expect(journal.slice(-4)).toEqual([
        'stop server',
        'backup 2.0.1',
        'dialog backupFailed disk full',
        'start server',
    ]);
});
it('makes the backup, starts the server again, then opens the download page on Linux', async () => {
    const { service, journal } = updates({ integratedInstall: false });

    await service.chooseFromMenu();

    expect(journal).toEqual([
        'check',
        'dialog available 2.0.1 linux',
        'stop server',
        'backup 2.0.1',
        'start server',
        'open https://example.test/v2.0.1',
    ]);
});
it('leaves the download page unopened when a failed Linux backup is cancelled', async () => {
    const { service, journal } = updates({
        integratedInstall: false,
        backups: [new Error('disk full')],
        answers: { backupFailed: [false] },
    });

    await service.chooseFromMenu();

    expect(journal.some((entry) => entry.startsWith('open '))).toBe(false);
});
it('ignores the menu while a check is running', async () => {
    const { service, journal } = updates({ checks: [null, null] });
    const first = service.chooseFromMenu();

    await service.chooseFromMenu();

    await first;
    expect(journal).toEqual(['check', 'dialog upToDate']);
});
