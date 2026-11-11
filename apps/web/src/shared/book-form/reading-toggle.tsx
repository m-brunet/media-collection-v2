import { useI18n } from '../i18n/i18n-context';
import { Button } from '../ui/button';

export function ReadingToggle({
    read,
    busy,
    onToggle,
}: {
    read: boolean;
    busy?: boolean;
    onToggle(read: boolean): void;
}) {
    const { t } = useI18n();

    return (
        <Button
            aria-pressed={read}
            icon={read ? 'check' : undefined}
            busy={busy}
            className={read ? 'button--pressed' : undefined}
            onClick={() => onToggle(!read)}
        >
            {t('details.readingToggle')}
        </Button>
    );
}

export function ReadingField({ read, onChange }: { read: boolean; onChange(read: boolean): void }) {
    const { t } = useI18n();

    return (
        <div className="field" role="group" aria-label={t('form.reading')}>
            <span className="field__label" aria-hidden="true">
                {t('form.reading')}
            </span>
            <div className="reading-field">
                <ReadingToggle read={read} onToggle={onChange} />
            </div>
        </div>
    );
}
