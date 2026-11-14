import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import { TlsSettings } from '../../domain/value-objects/tls-settings.value-object.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { SaveHttpsPortUseCase } from '../ports/driving/save-https-port-use-case.interface.js';
import { SettingsAudit } from '../settings-audit.js';

export class SaveHttpsPort implements SaveHttpsPortUseCase {
    constructor(
        private readonly store: TlsStore,
        private readonly http: HttpSettingsReader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: { port: number }): Promise<TlsSettingsState> {
        return this.operations.run(
            {
                category: SettingsAudit.httpsPort,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'https',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const previous = await this.store.read();
                const settings = new TlsSettings({ ...previous, port: input.port });

                Failure.ensure(
                    settings.port !== (await this.http.read()).port,
                    'HTTP and HTTPS must use different ports.',
                    'ports-identical',
                );

                if (settings.port !== previous.port) {
                    await this.store.save(settings);
                }

                return {
                    result: settings.snapshot(),
                    before: { port: previous.port },
                    after: { port: settings.port },
                };
            },
        );
    }
}
