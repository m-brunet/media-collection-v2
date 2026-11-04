import {
    auditedOperation,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { MemoryUsers, user } from './identity-doubles.test-support.js';

// The protected administrator plus one Owner and one Guest, for account administration tests.
export async function household() {
    const users = new MemoryUsers();
    const trail = new MemoryAuditTrail();
    const administrator = user({ id: 'admin', username: 'admin', role: 'admin' });

    await users.create(administrator);
    await users.create(user({ id: 'owner', username: 'camille', role: 'owner' }));
    await users.create(user({ id: 'guest', username: 'morgan', role: 'guest' }));

    return { users, trail, operations: auditedOperation(trail), admin: administrator.actor };
}
