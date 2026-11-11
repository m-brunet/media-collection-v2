import type { ReceiverChoice } from '../lending-input.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { Receiver } from '../../domain/entities/receiver.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface ResolvedReceiver {
    receiver: Receiver;
    created: boolean;
}

export class ReceiverResolver {
    constructor(
        private readonly receivers: ReceiverRepository,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async resolve(choice: ReceiverChoice): Promise<ResolvedReceiver> {
        return 'id' in choice ? this.existing(choice.id) : this.named(choice);
    }

    private async existing(id: string): Promise<ResolvedReceiver> {
        const receiver = await this.receivers.findById(id);

        if (!receiver) {
            throw new Failure('not_found', 'That receiver no longer exists.', 'receiver-missing');
        }

        return { receiver, created: false };
    }

    private async named(choice: { name: string; distinct?: boolean }): Promise<ResolvedReceiver> {
        const name = Receiver.validName(choice.name);
        const equivalent = await this.receivers.findByKey(NameKey.of(name));

        if (equivalent) {
            return { receiver: equivalent, created: false };
        }

        if (!choice.distinct) {
            const similar = (await this.receivers.list()).filter((receiver) =>
                NameKey.similar(receiver.snapshot.name, name),
            );

            if (similar.length > 0) {
                throw new Failure(
                    'conflict',
                    'A receiver with a similar name already exists.',
                    'receiver-similar',
                    {
                        name,
                        candidates: similar.map((receiver) => ({
                            id: receiver.id,
                            name: receiver.snapshot.name,
                        })),
                    },
                );
            }
        }

        const receiver = new Receiver({
            id: this.ids.next(),
            name,
            createdAt: this.clock.now().toISOString(),
        });

        await this.receivers.create(receiver);

        return { receiver, created: true };
    }
}
