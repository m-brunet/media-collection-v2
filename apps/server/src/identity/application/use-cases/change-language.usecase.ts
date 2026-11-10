import type { ChangeLanguageUseCase } from '../ports/driving/change-language-use-case.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor, InterfaceLanguage } from '../../../shared/domain/actor.helper.js';
import { AccountAudit } from '../account-audit.js';
import { AccountLoader } from '../services/account-loader.service.js';

export class ChangeLanguage implements ChangeLanguageUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, language: InterfaceLanguage): Promise<Actor> {
        return this.operations.run(
            {
                category: AccountAudit.languageChanged,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: actor.id,
            },
            async () => {
                const user = await this.accounts.load(actor.id);
                const before = { language: user.actor.language };

                user.chooseLanguage(language);
                await this.users.save(user, user.snapshot.tokenVersion);

                return {
                    result: { ...user.actor, mustChangePassword: actor.mustChangePassword },
                    before,
                    after: { language },
                };
            },
        );
    }
}
