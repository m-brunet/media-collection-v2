import type { SetupStatusUseCase } from '../ports/driving/setup-status-use-case.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';

export class SetupStatus implements SetupStatusUseCase {
    constructor(private readonly users: UserReader) {}

    async execute(): Promise<{ required: boolean }> {
        return { required: (await this.users.list()).length === 0 };
    }
}
