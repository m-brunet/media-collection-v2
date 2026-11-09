import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { HttpInternetAccessReader } from '../ports/driven/http-internet-access-reader.interface.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';
import type { LocalAddressReader } from '../ports/driven/local-address-reader.interface.js';
import type { HttpInternetAccessView } from '../ports/driving/http-internet-access-view.interface.js';
import type { ReadHttpInternetAccessUseCase } from '../ports/driving/read-http-internet-access-use-case.interface.js';

export class ReadHttpInternetAccess implements ReadHttpInternetAccessUseCase {
    constructor(
        private readonly store: HttpInternetAccessReader,
        private readonly names: DomainNameReader,
        private readonly http: HttpSettingsReader,
        private readonly local: LocalAddressReader,
    ) {}

    async execute(actor: Actor): Promise<HttpInternetAccessView> {
        ActorAuthorization.requireAdmin(actor);
        const access = await this.store.read();
        const state = access.snapshot;

        if (state.phase !== 'open') {
            return { ...state, origin: null, manualRule: null };
        }

        const { port } = await this.http.read();
        const host = (await this.names.read()) ?? state.publicAddress;

        return {
            ...state,
            origin: 'http://' + host + ':' + port,
            manualRule:
                state.mapping === 'manual'
                    ? {
                          localAddress: await this.local.current(),
                          internalPort: port,
                          externalPort: port,
                          protocol: 'TCP',
                      }
                    : null,
        };
    }
}
