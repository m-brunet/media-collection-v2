import type { BookCategory } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../i18n/i18n-context';
import { ChoiceButtons } from '../ui/choice-buttons';
import { BookFormat } from './book-format.util';
import type { CategoryRule } from './category-lock.util';

export function CategoryField({
    value,
    rule,
    onChange,
}: {
    value: BookCategory;
    rule: CategoryRule;
    onChange(category: BookCategory): void;
}) {
    const { t } = useI18n();
    const hint =
        rule.kind === 'locked'
            ? t('form.categoryLocked', {
                  name: rule.collection.name,
                  category: t(BookFormat.category(rule.collection.category)),
              })
            : rule.kind === 'member'
              ? t('form.categoryMember', { name: rule.name })
              : undefined;

    return (
        <ChoiceButtons
            label={t('form.category')}
            value={value}
            disabled={rule.kind === 'locked'}
            hint={hint}
            choices={BookFormat.categories.map((category) => ({
                value: category,
                label: t(BookFormat.category(category)),
            }))}
            onChange={onChange}
        />
    );
}
