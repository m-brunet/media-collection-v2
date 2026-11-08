import { expect, it } from 'vitest';
import { ReadHttpSettings } from './read-http-settings.usecase.js';
import { actor, SettingsDoubles } from '../testing/settings-doubles.test-support.js';

it('reads the saved HTTP preference for an administrator', async () => {
    const { http } = SettingsDoubles.setup(undefined, { port: 36000 });
    const subject = new ReadHttpSettings(http);

    const result = await subject.execute(actor);

    expect(result).toEqual({ port: 36000 });
});

it('rejects a non-administrator reading HTTP settings', async () => {
    const { http } = SettingsDoubles.setup();
    const subject = new ReadHttpSettings(http);
    const forbidden = { ...actor, role: 'owner' as const };

    const operation = () => subject.execute(forbidden);

    expect(operation).toThrow('Administrator');
});

it('rejects HTTP settings access before password setup', async () => {
    const { http } = SettingsDoubles.setup();
    const subject = new ReadHttpSettings(http);
    const forbidden = { ...actor, mustChangePassword: true };

    const operation = () => subject.execute(forbidden);

    expect(operation).toThrow();
});
