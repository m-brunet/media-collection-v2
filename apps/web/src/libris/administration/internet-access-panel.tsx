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
import { SettingIds, SettingRow } from './setting-row';
import type { PillTone } from './status-pill';
import { StatusPill } from './status-pill';

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
            <p className="muted">{t('internet.intro')}</p>
            <div className="setting-rows">
                <HttpsInternetSection status={status} onStatus={onStatus} />
                <DomainNameSection
                    domainName={domainName}
                    httpsOn={status.phase !== 'off'}
                    onSaved={onRefresh}
                />
                <HttpInternetSection
                    status={http}
                    httpsActive={status.phase === 'active'}
                    onChanged={onRefresh}
                />
                <SettingRow
                    id="keep-awake"
                    title={t('keepAwake.label')}
                    detail={t('keepAwake.hint')}
                    control={
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                checked={keepAwake}
                                disabled={awake.busy}
                                onChange={(event) => changeKeepAwake(event.currentTarget.checked)}
                                aria-labelledby={SettingIds.title('keep-awake')}
                                aria-describedby={SettingIds.detail('keep-awake')}
                            />
                            <span aria-hidden="true">{t('keepAwake.control')}</span>
                        </label>
                    }
                >
                    {awake.feedback && (
                        <Notice tone={awake.feedback.tone}>{awake.feedback.text}</Notice>
                    )}
                </SettingRow>
            </div>
        </Panel>
    );
}

const phasePills: Record<InternetAccessStatus['phase'], { tone: PillTone; label: MessageKey }> = {
    off: { tone: 'off', label: 'reach.off' },
    'setting-up': { tone: 'off', label: 'reach.settingUp' },
    'waiting-for-port': { tone: 'warn', label: 'reach.needsHelp' },
    active: { tone: 'on', label: 'reach.on' },
};

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
              port: status.routerPort ?? '',
          })
        : null;
    const dismissAddressNotice = () =>
        void action.run(async () =>
            onStatus(
                await api.request<InternetAccessStatus>(
                    '/server-settings/internet-access/address-notice',
                    { method: 'DELETE' },
                ),
            ),
        );
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
    const blocked = status.retryAfter !== null;
    const checking = status.phase === 'active' && status.step !== null;
    const check = () =>
        void action.run(async () =>
            onStatus(
                await api.request<InternetAccessStatus>('/server-settings/internet-access/check', {
                    method: 'POST',
                }),
            ),
        );
    const pill = phasePills[status.phase];
    const detail =
        status.phase === 'off' ? (
            <>
                {t('internet.terms')}{' '}
                <a href={termsAddress} target="_blank" rel="noreferrer">
                    {t('internet.termsLink')}
                </a>
            </>
        ) : status.phase === 'setting-up' ? (
            t('internet.settingUpDetail')
        ) : status.phase === 'waiting-for-port' ? (
            t('internet.waitingDetail')
        ) : status.allowances && !checking ? (
            <Allowances status={status} allowances={status.allowances} />
        ) : (
            t('internet.active')
        );

    return (
        <SettingRow
            id="https-internet"
            title={t('internet.httpsTitle')}
            detail={detail}
            control={
                <>
                    <StatusPill tone={pill.tone} label={t(pill.label)} />
                    {status.phase === 'off' && (
                        <Button
                            variant="primary"
                            busy={action.busy}
                            disabled={blocked}
                            onClick={start}
                        >
                            {t('internet.setUp')}
                        </Button>
                    )}
                    {(status.phase === 'waiting-for-port' ||
                        (status.phase === 'active' && status.awaitingCheck && !checking)) && (
                        <Button
                            variant="primary"
                            busy={action.busy}
                            disabled={blocked}
                            onClick={check}
                        >
                            {t('internet.check')}
                        </Button>
                    )}
                    {(status.phase === 'active' || status.phase === 'waiting-for-port') && (
                        <Button variant="secondary" onClick={() => setTurningOff(true)}>
                            {t('internet.turnOff')}
                        </Button>
                    )}
                </>
            }
        >
            {status.phase === 'off' && failure && <Notice tone="error">{failure}</Notice>}
            {status.phase === 'setting-up' && <SetupSteps current={status.step} />}
            {status.phase === 'waiting-for-port' && failure && (
                <Notice tone="warning">{failure}</Notice>
            )}
            {status.phase === 'active' && status.addressMoved && status.origin && (
                <Notice tone="warning" onClose={dismissAddressNotice}>
                    {t('internet.addressMoved', { address: status.origin })}
                    {status.mapping === 'manual' && ' ' + t('internet.addressMovedByHand')}
                </Notice>
            )}
            {checking && <Notice tone="info">{t('internet.checking')}</Notice>}
            {status.phase === 'active' && failure && !checking && (
                <Notice tone="warning">
                    {status.awaitingCheck
                        ? t('internet.awaitingCheck', { reason: failure })
                        : t('internet.lastFailure', {
                              reason: failure,
                              date: status.nextAttemptAt
                                  ? dates.dateTime(status.nextAttemptAt)
                                  : '',
                          })}
                </Notice>
            )}
            {status.retryAfter && (
                <Notice tone="warning">
                    {t('internet.retryAfter', { date: dates.dateTime(status.retryAfter) })}
                </Notice>
            )}
            {status.allowances && status.phase !== 'active' && (
                <p className="muted">
                    <Allowances status={status} allowances={status.allowances} />
                </p>
            )}
            {status.allowances && !checking && <ProbablyRefused allowances={status.allowances} />}
            {(status.phase === 'waiting-for-port' ||
                (status.phase === 'active' && status.mapping === 'manual')) && (
                <RulesByHand status={status} />
            )}
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
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
        </SettingRow>
    );
}

function RulesByHand({ status }: { status: InternetAccessStatus }) {
    const { t, dates } = useI18n();
    const addressOnly = status.domain === null;

    return (
        <>
            {status.phase === 'active' && addressOnly && (
                <Notice tone="info">{t('internet.checkRulePermanent')}</Notice>
            )}
            {status.phase === 'active' && !addressOnly && status.renewalAt && (
                <Notice tone="info">
                    {t('internet.checkRuleReminder', { date: dates.dateTime(status.renewalAt) })}
                </Notice>
            )}
            {status.manualRule && <ManualRule rule={status.manualRule} />}
            {status.checkRule && (
                <ManualRule
                    rule={status.checkRule}
                    title={
                        addressOnly ? 'internet.checkRulePermanentTitle' : 'internet.checkRuleTitle'
                    }
                    intro={
                        addressOnly ? 'internet.checkRulePermanentIntro' : 'internet.checkRuleIntro'
                    }
                />
            )}
        </>
    );
}

function Allowances({
    status,
    allowances,
}: {
    status: InternetAccessStatus;
    allowances: NonNullable<InternetAccessStatus['allowances']>;
}) {
    const { t } = useI18n();
    const name = status.domain ?? status.publicAddress ?? status.certificate?.address ?? '';

    return (
        <>
            <span>
                {t('internet.allowanceCertificates', {
                    name,
                    count: allowances.certificates.left,
                })}{' '}
                {t('internet.allowanceChecks', { count: allowances.checks.left })}
            </span>{' '}
            <span>{t('internet.allowanceEstimate')}</span>
        </>
    );
}

function ProbablyRefused({
    allowances,
}: {
    allowances: NonNullable<InternetAccessStatus['allowances']>;
}) {
    const { t, dates } = useI18n();
    const empty = [allowances.certificates.nextAt, allowances.checks.nextAt]
        .filter((date): date is string => date !== null)
        .sort()
        .at(-1);

    return empty ? (
        <Notice tone="warning">
            {t('internet.probablyRefused', { date: dates.dateTime(empty) })}
        </Notice>
    ) : null;
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
