import { useState } from 'react';
import type {
    InternetAccessFailureReason,
    InternetAccessStatus,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { QrCode } from '../../shared/ui/qr-code';
import { useAction } from '../../shared/use-action';

const steps = [
    { step: 'router', label: 'internet.stepRouter' },
    { step: 'port', label: 'internet.stepPort' },
    { step: 'certificate', label: 'internet.stepCertificate' },
] as const;
const stepStates: Record<'done' | 'running' | 'waiting', MessageKey> = {
    done: 'internet.stepDone',
    running: 'internet.stepRunning',
    waiting: 'internet.stepWaiting',
};
const failures: Record<InternetAccessFailureReason, MessageKey> = {
    'no-router': 'internet.failure.no-router',
    cgnat: 'internet.failure.cgnat',
    'double-nat': 'internet.failure.double-nat',
    'port-refused': 'internet.failure.port-refused',
    'not-reachable': 'internet.failure.not-reachable',
    'public-address-unknown': 'internet.failure.public-address-unknown',
    'rate-limited': 'internet.failure.rate-limited',
    'authority-unavailable': 'internet.failure.authority-unavailable',
    'https-unavailable': 'internet.failure.https-unavailable',
    'setup-failed': 'internet.failure.setup-failed',
};
const termsAddress = 'https://letsencrypt.org/repository/';

// One action that opens the router port and gets a Let's Encrypt certificate, then the address and
// QR code phones use. The page refreshes the status while a setup runs.
export function InternetAccessPanel({
    status,
    keepAwake,
    onStatus,
    onKeepAwake,
}: {
    status: InternetAccessStatus;
    keepAwake: boolean;
    onStatus(status: InternetAccessStatus): void;
    onKeepAwake(enabled: boolean): void;
}) {
    const { t, dates } = useI18n();
    const action = useAction();
    const awake = useAction();
    const [replacing, setReplacing] = useState(false);
    const [turningOff, setTurningOff] = useState(false);
    const failure = status.failure ? t(failures[status.failure.reason]) : null;
    const setUp = (replaceCertificate: boolean) =>
        api.request<InternetAccessStatus>('/server-settings/internet-access', {
            method: 'POST',
            body: replaceCertificate ? { replaceCertificate } : {},
        });
    const start = () =>
        void action.run(async () => {
            try {
                onStatus(await setUp(false));
            } catch (error) {
                if (
                    error instanceof ApiError &&
                    error.reason === 'certificate-replacement-unconfirmed'
                ) {
                    setReplacing(true);

                    return;
                }

                throw error;
            }
        });
    const check = () =>
        void action.run(async () =>
            onStatus(
                await api.request<InternetAccessStatus>('/server-settings/internet-access/check', {
                    method: 'POST',
                }),
            ),
        );
    const changeKeepAwake = (enabled: boolean) =>
        void awake.run(async () => {
            const saved = await api.request<{ enabled: boolean }>('/server-settings/keep-awake', {
                method: 'PUT',
                body: { enabled },
            });

            onKeepAwake(saved.enabled);
        });

    return (
        <Panel title={t('internet.title')}>
            <div className="internet-access">
                <p className="muted">{t('internet.intro')}</p>
                {status.phase === 'setting-up' && <SetupSteps current={status.step} />}
                {status.phase === 'active' && status.origin && status.certificate && (
                    <>
                        <Notice tone="success">{t('internet.active')}</Notice>
                        <ActiveAddress origin={status.origin} />
                        <p>
                            {t('internet.validUntil', {
                                date: dates.dateTime(status.certificate.expiresAt),
                            })}
                        </p>
                        {failure && (
                            <Notice tone="warning">
                                {t('internet.lastFailure', {
                                    reason: failure,
                                    date: status.nextAttemptAt
                                        ? dates.dateTime(status.nextAttemptAt)
                                        : '',
                                })}
                            </Notice>
                        )}
                    </>
                )}
                {status.phase === 'waiting-for-port' && (
                    <>
                        {failure && <Notice tone="warning">{failure}</Notice>}
                        {status.manualRule && <ManualRule rule={status.manualRule} />}
                    </>
                )}
                {status.phase === 'off' && failure && <Notice tone="error">{failure}</Notice>}
                {(status.phase === 'active' || status.phase === 'waiting-for-port') && (
                    <p className="muted">{t('internet.firewall')}</p>
                )}
                {action.feedback && (
                    <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>
                )}
                <div className="actions">
                    {status.phase === 'off' && (
                        <Button variant="primary" busy={action.busy} onClick={start}>
                            {t('internet.setUp')}
                        </Button>
                    )}
                    {status.phase === 'waiting-for-port' && (
                        <Button variant="primary" busy={action.busy} onClick={check}>
                            {t('internet.check')}
                        </Button>
                    )}
                    {(status.phase === 'active' || status.phase === 'waiting-for-port') && (
                        <Button variant="secondary" onClick={() => setTurningOff(true)}>
                            {t('internet.turnOff')}
                        </Button>
                    )}
                </div>
                {status.phase === 'off' && (
                    <p className="muted">
                        {t('internet.terms')}{' '}
                        <a href={termsAddress} target="_blank" rel="noreferrer">
                            {t('internet.termsLink')}
                        </a>
                    </p>
                )}
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={keepAwake}
                        disabled={awake.busy}
                        onChange={(event) => changeKeepAwake(event.currentTarget.checked)}
                        aria-describedby="keep-awake-hint"
                    />
                    {t('keepAwake.label')}
                </label>
                <p id="keep-awake-hint" className="muted">
                    {t('keepAwake.hint')}
                </p>
                {awake.feedback && (
                    <Notice tone={awake.feedback.tone}>{awake.feedback.text}</Notice>
                )}
            </div>
            <ConfirmDialog
                open={replacing}
                title={t('internet.replaceTitle')}
                body={t('internet.replaceBody')}
                confirm={t('internet.replace')}
                onConfirm={async () => {
                    onStatus(await setUp(true));
                    setReplacing(false);
                }}
                onClose={() => setReplacing(false)}
            />
            <ConfirmDialog
                open={turningOff}
                title={t('internet.turnOffTitle')}
                body={t('internet.turnOffBody')}
                confirm={t('internet.turnOff')}
                onConfirm={async () => {
                    onStatus(
                        await api.request<InternetAccessStatus>(
                            '/server-settings/internet-access',
                            { method: 'DELETE' },
                        ),
                    );
                    setTurningOff(false);
                }}
                onClose={() => setTurningOff(false)}
            />
        </Panel>
    );
}

function SetupSteps({ current }: { current: InternetAccessStatus['step'] }) {
    const { t } = useI18n();
    const index = steps.findIndex((entry) => entry.step === current);

    return (
        <ol className="internet-access__steps" aria-live="polite">
            {steps.map((entry, position) => {
                const state =
                    position < index ? 'done' : position === index ? 'running' : 'waiting';

                return (
                    <li
                        key={entry.step}
                        aria-current={state === 'running' ? 'step' : undefined}
                        className={'internet-access__step internet-access__step--' + state}
                    >
                        <span>{t(entry.label)}</span>
                        <span className="muted">{t(stepStates[state])}</span>
                    </li>
                );
            })}
        </ol>
    );
}

function ActiveAddress({ origin }: { origin: string }) {
    const { t } = useI18n();
    const leaf = origin + '/leaf/';

    return (
        <div className="internet-access__address">
            <dl className="internet-access__facts">
                <div>
                    <dt>{t('internet.address')}</dt>
                    <dd>
                        <a href={leaf} target="_blank" rel="noreferrer">
                            {leaf}
                        </a>
                    </dd>
                </div>
            </dl>
            <figure className="internet-access__qr">
                <QrCode value={leaf} label={t('internet.qrAlt', { address: leaf })} />
                <figcaption className="muted">{t('internet.qr')}</figcaption>
            </figure>
        </div>
    );
}

function ManualRule({ rule }: { rule: NonNullable<InternetAccessStatus['manualRule']> }) {
    const { t } = useI18n();

    return (
        <div>
            <h3 className="internet-access__subtitle">{t('internet.manualTitle')}</h3>
            <p>{t('internet.manualIntro')}</p>
            <dl className="internet-access__facts">
                <div>
                    <dt>{t('internet.manualProtocol')}</dt>
                    <dd>{rule.protocol}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualExternal')}</dt>
                    <dd>{rule.externalPort}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualAddress')}</dt>
                    <dd>{rule.localAddress ?? t('internet.manualUnknown')}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualInternal')}</dt>
                    <dd>{rule.internalPort}</dd>
                </div>
            </dl>
        </div>
    );
}
