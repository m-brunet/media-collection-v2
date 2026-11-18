import type { BookcaseSize } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { ChoiceButtons } from '../../shared/ui/choice-buttons';

export function BookcaseWidthSwitch({
    size,
    onChange,
}: {
    size: BookcaseSize;
    onChange(size: BookcaseSize): void;
}) {
    const { t } = useI18n();

    return (
        <div className="wall-bookcase__width">
            <ChoiceButtons<BookcaseSize>
                label={t('bookcase.width')}
                value={size}
                choices={[
                    { value: 'large', label: t('bookcase.large') },
                    { value: 'small', label: t('bookcase.small') },
                ]}
                onChange={onChange}
            />
        </div>
    );
}
