import type { ListUsersUseCase } from '../ports/driving/list-users-use-case.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { AccountSummary } from '../../domain/entities/user.entity.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListUsers implements ListUsersUseCase {
    constructor(private readonly users: UserReader) {}

    async execute(actor: Actor): Promise<AccountSummary[]> {
        ActorAuthorization.requireAdmin(actor);

        return (await this.users.list()).map((user) => user.summary);
    }
}
