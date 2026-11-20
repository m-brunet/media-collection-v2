import { Icon } from '../../shared/ui/icon';

export function IconAction({
    icon,
    label,
    danger = false,
    onClick,
}: {
    icon: 'edit' | 'add' | 'delete';
    label: string;
    danger?: boolean;
    onClick(): void;
}) {
    return (
        <button
            type="button"
            className={danger ? 'icon-action icon-action--danger' : 'icon-action'}
            aria-label={label}
            title={label}
            onClick={onClick}
        >
            <Icon name={icon} size={14} />
        </button>
    );
}
