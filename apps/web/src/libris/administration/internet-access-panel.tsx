import { useState } from 'react';
import type {
    HttpInternetAccessStatus,
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
import { useAction } from '../../shared/use-action';
import { DomainNameSection } from './domain-name-section';
import { HttpInternetSection } from './http-internet-section';
import { ManualRule } from './manual-rule';

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
    'domain-unresolved': 'internet.failure.domain-unresolved',
    'domain-mismatch': 'internet.failure.domain-mismatch',
    'setup-failed': 'internet.failure.setup-failed',
};
const termsAddress = 'https://letsencrypt.org/repository/';

export function InternetAccessPanel({
    status,
    http,
    domainName,
    keepAwake,
    onStatus,
    onRefresh,
    onKeepAwake,
}: {
    status: InternetAccessStatus;
    http: HttpInternetAccessStatus;
    domainName: string | null;
    keepAwake: boolean;
    onStatus(status: InternetAccessStatus): void;
    onRefresh(): void;
    onKeepAwake(enabled: boolean): void;
}) {
    const { t } = useI18n();
    const awake = useAction();
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
                <DomainNameSection
                    domainName={domainName}
                    httpsOn={status.phase !== 'off'}
                    onSaved={onRefresh}
                />
                <HttpsInternetSection status={status} onStatus={onStatus} />
                <HttpInternetSection
                    status={http}
                    httpsActive={status.phase === 'active'}
                    onChanged={onRefresh}
                />
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
        </Panel>
    );
}

function HttpsInternetSection({
    status,
    onStatus,
}: {
    status: InternetAccessStatus;
    onStatus(status: InternetAccessStatus): void;
}) {
    const { t, dates } = useI18n();
    const action = useAction();
    const [replacing, setReplacing] = useState(false);
    const [turningOff, setTurningOff] = useState(false);
    const failure = status.failure
        ? t(failures[status.failure.reason], {
              domain: status.domain ?? '',
              address: status.publicAddress ?? '',
          })
        : null;
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

    return (
        <section className="internet-access__section" aria-labelledby="https-internet-title">
            <h3 id="https-internet-title" className="internet-access__subtitle">
                {t('internet.httpsTitle')}
            </h3>
            {status.phase === 'setting-up' && <SetupSteps current={status.step} />}
            {status.phase === 'active' && status.origin && status.certificate && (
                <>
                    <Notice tone="success">{t('internet.active')}</Notice>
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
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            {status.phase === 'off' && (
                <p className="muted">
                    {t('internet.terms')}{' '}
                    <a href={termsAddress} target="_blank" rel="noreferrer">
                        {t('internet.termsLink')}
                    </a>
                </p>
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
        </section>
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
