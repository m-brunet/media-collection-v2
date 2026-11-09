import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';

// Why the server refused to save the name; the public address helps the Admin compare.
const refusals: Record<string, MessageKey> = {
    'domain-unresolved': 'internet.domainRefused.unresolved',
    'domain-mismatch': 'internet.domainRefused.mismatch',
    'public-address-unknown': 'internet.domainRefused.addressUnknown',
};

// The Admin's domain name: saved only once it points to this connection, then used by every
// internet address. It can be removed while HTTPS is off.
export function DomainNameSection({
    domainName,
    httpsOn,
    onSaved,
}: {
    domainName: string | null;
    httpsOn: boolean;
    onSaved(): void;
}) {
    const { t } = useI18n();
    const [value, setValue] = useState(domainName ?? '');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
        null,
    );
    const save = async (domain: string | null) => {
        setBusy(true);
        setFeedback(null);

        try {
            const saved = await api.request<{ domain: string | null }>(
                '/server-settings/domain-name',
                { method: 'PUT', body: { domain } },
            );

            setValue(saved.domain ?? '');
            setFeedback({
                tone: 'success',
                text: t(saved.domain ? 'internet.domainSaved' : 'internet.domainRemoved'),
            });
            onSaved();
        } catch (error) {
            const refusal =
                error instanceof ApiError && error.reason ? refusals[error.reason] : undefined;
            const address = error instanceof ApiError ? error.details?.publicAddress : undefined;

            setFeedback({
                tone: 'error',
                text: refusal
                    ? t(refusal, { address: typeof address === 'string' ? address : '' })
                    : t(ApiErrorMessage.key(error)),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            className="internet-access__domain"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                void save(value.trim() || null);
            }}
        >
            <TextField
                label={t('internet.domain')}
                hint={t('internet.domainHint')}
                name="domain"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="home.example.com"
                autoComplete="off"
                spellCheck={false}
                maxLength={253}
            />
            {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" busy={busy}>
                    {t('internet.domainSave')}
                </Button>
                {domainName && !httpsOn && (
                    <Button variant="ghost" busy={busy} onClick={() => void save(null)}>
                        {t('internet.domainRemove')}
                    </Button>
                )}
            </div>
            {domainName && httpsOn && <p className="muted">{t('internet.domainLocked')}</p>}
        </form>
    );
}
