import type { SaveTlsSettingsUseCase } from '../ports/driving/save-tls-settings-use-case.interface.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import { TlsSettings } from '../../domain/value-objects/tls-settings.value-object.js';
import type { CertificateValidator } from '../ports/driven/certificate-validator.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { SettingsAudit } from '../settings-audit.js';

export class SaveTlsSettings implements SaveTlsSettingsUseCase {
    constructor(
        private readonly store: TlsStore,
        private readonly certificates: CertificateValidator,
        private readonly http: HttpSettingsReader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        input: { enabled: boolean; port: number; chain?: string; key?: string },
    ): Promise<TlsSettingsState> {
        return this.operations.run(
            {
                category: SettingsAudit.https,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'https',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const previous = await this.store.read();
                const supplying = input.chain !== undefined || input.key !== undefined;

                Failure.ensure(
                    !supplying || (!!input.chain && !!input.key),
                    'Supply both the certificate chain and private key.',
                    'certificate-incomplete',
                );

                if (supplying) {
                    this.certificates.validate(input.chain!, input.key!);
                }

                const settings = new TlsSettings({
                    enabled: input.enabled,
                    port: input.port,
                    hasCertificate: supplying || previous.hasCertificate,
                });
                const http = await this.http.read();

                Failure.ensure(
                    !settings.enabled || settings.port !== http.port,
                    'HTTP and HTTPS must use different ports.',
                    'ports-identical',
                );
                await this.store.save(
                    settings,
                    supplying ? { chain: input.chain!, key: input.key! } : undefined,
                );

                // Only the enabled state, port and certificate presence are recorded.
                return {
                    result: settings.snapshot(),
                    before: { ...previous, certificateReplaced: false },
                    after: { ...settings.snapshot(), certificateReplaced: supplying },
                };
            },
        );
    }
}
