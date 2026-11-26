import type { SaveTlsSettingsUseCase } from '../ports/driving/save-tls-settings-use-case.interface.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import { TlsSettings } from '../../domain/value-objects/tls-settings.value-object.js';
import type { CertificateValidator } from '../ports/driven/certificate-validator.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
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
        private readonly internetAccess: InternetAccessStore,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        input: { enabled: boolean; chain?: string; key?: string },
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

                const access = await this.internetAccess.read();

                if (access.phase !== 'off') {
                    throw new Failure(
                        'conflict',
                        'Turn off internet access before changing the HTTPS settings.',
                        'internet-access-on',
                    );
                }

                const previous = await this.store.read();
                const supplying = input.chain !== undefined || input.key !== undefined;

                Failure.ensure(
                    !supplying || (!!input.chain && !!input.key),
                    'Supply both the certificate chain and private key.',
                    'certificate-incomplete',
                );

                const certificate =
                    input.chain && input.key ? { chain: input.chain, key: input.key } : undefined;

                if (certificate) {
                    this.certificates.validate(certificate.chain, certificate.key);
                }

                const settings = new TlsSettings({
                    enabled: input.enabled,
                    port: previous.port,
                    hasCertificate: supplying || previous.hasCertificate,
                });
                const http = await this.http.read();

                Failure.ensure(
                    !settings.enabled || settings.port !== http.port,
                    'HTTP and HTTPS must use different ports.',
                    'ports-identical',
                );
                await this.store.save(settings, certificate);

                if (certificate) {
                    access.forgetCertificate();
                    await this.internetAccess.save(access);
                }

                return {
                    result: settings.snapshot(),
                    before: { ...previous, certificateReplaced: false },
                    after: { ...settings.snapshot(), certificateReplaced: supplying },
                };
            },
        );
    }
}
