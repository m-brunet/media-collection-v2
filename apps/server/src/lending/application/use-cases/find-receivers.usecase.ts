import type { FindReceiversUseCase } from '../ports/driving/find-receivers-use-case.interface.js';
import type { ReceiverReference } from '../lending-input.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// Suggestions for the receiver name field: case, accents and outer spaces are ignored, and any
// part of the name matches.
export class FindReceivers implements FindReceiversUseCase {
    private static readonly limit = 10;

    constructor(private readonly receivers: ReceiverRepository) {}

    async execute(actor: Actor, search: string): Promise<ReceiverReference[]> {
        ActorAuthorization.requireReady(actor);
        const key = NameKey.of(search);

        return (await this.receivers.list())
            .filter((receiver) => key.length > 0 && receiver.key.includes(key))
            .slice(0, FindReceivers.limit)
            .map((receiver) => ({ id: receiver.id, name: receiver.snapshot.name }));
    }
}
