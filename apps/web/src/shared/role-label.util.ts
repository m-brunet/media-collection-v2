import type { AccountRole } from '../../../../packages/contracts/src/http';
import type { MessageKey } from './i18n/catalog-en';

export class RoleLabel {
    private static readonly names: Record<AccountRole, MessageKey> = {
        admin: 'role.admin',
        owner: 'role.owner',
        guest: 'role.guest',
    };

    private static readonly descriptions: Record<AccountRole, MessageKey> = {
        admin: 'role.adminDescription',
        owner: 'role.ownerDescription',
        guest: 'role.guestDescription',
    };

    static name(role: AccountRole): MessageKey {
        return RoleLabel.names[role];
    }

    static description(role: AccountRole): MessageKey {
        return RoleLabel.descriptions[role];
    }
}
