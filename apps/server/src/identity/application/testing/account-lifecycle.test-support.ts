import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { IdentityDoubles, MemoryUsers } from './identity-doubles.test-support.js';

export class AccountLifecycle {
    static async household() {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();
        const administrator = IdentityDoubles.user({
            id: 'admin',
            username: 'admin',
            role: 'admin',
        });

        await users.create(administrator);
        await users.create(
            IdentityDoubles.user({ id: 'owner', username: 'camille', role: 'owner' }),
        );
        await users.create(
            IdentityDoubles.user({ id: 'guest', username: 'morgan', role: 'guest' }),
        );

        return {
            users,
            trail,
            operations: AuditDoubles.auditedOperation(trail),
            admin: administrator.actor,
        };
    }
}
