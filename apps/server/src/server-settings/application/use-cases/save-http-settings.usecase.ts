import type { SaveHttpSettingsUseCase } from '../ports/driving/save-http-settings-use-case.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { HttpSettingsState } from '../../domain/value-objects/http-settings.value-object.js';
import { HttpSettings } from '../../domain/value-objects/http-settings.value-object.js';
import type { HttpSettingsStore } from '../ports/driven/http-settings-store.interface.js';
import type { HttpInternetAccessReader } from '../ports/driven/http-internet-access-reader.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { SettingsAudit } from '../settings-audit.js';

export class SaveHttpSettings implements SaveHttpSettingsUseCase {
    constructor(
        private readonly store: HttpSettingsStore,
        private readonly tls: TlsSettingsReader,
        private readonly internet: HttpInternetAccessReader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: HttpSettingsState): Promise<HttpSettingsState> {
        return this.operations.run(
            {
                category: SettingsAudit.http,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'http',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const settings = new HttpSettings(input.port);
                const tls = await this.tls.read();
                const before = (await this.store.read()).snapshot();

                Failure.ensure(
                    !tls.enabled || tls.port !== settings.port,
                    'HTTP and HTTPS must use different ports.',
                    'ports-identical',
                );

                if (
                    settings.port !== before.port &&
                    (await this.internet.read()).phase === 'open'
                ) {
                    throw new Failure(
                        'conflict',
                        'Close HTTP from the internet before changing the HTTP port.',
                        'internet-access-on',
                    );
                }

                await this.store.save(settings);

                return {
                    result: settings.snapshot(),
                    before: { ...before },
                    after: { ...settings.snapshot() },
                };
            },
        );
    }
}
