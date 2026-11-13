import type { ComponentProps } from 'react';
import { useI18n } from '../i18n/i18n-context';
import { Button } from '../ui/button';
import { BookFormat } from './book-format.util';

export function ReadingToggle({
    read,
    busy,
    label,
    onToggle,
    ...rest
}: Pick<ComponentProps<'button'>, 'aria-describedby' | 'onFocus' | 'onBlur' | 'onKeyDown'> & {
    read: boolean;
    busy?: boolean;
    label?: string;
    onToggle(read: boolean): void;
}) {
    const { t } = useI18n();

    return (
        <Button
            {...rest}
            icon={read ? 'check' : undefined}
            busy={busy}
            className={read ? 'button--pressed' : undefined}
            onClick={() => onToggle(!read)}
        >
            {label ?? t(BookFormat.reading(read))}
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
