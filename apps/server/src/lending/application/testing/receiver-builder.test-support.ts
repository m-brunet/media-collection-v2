import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { Receiver } from '../../domain/entities/receiver.entity.js';
import { EntityBuilder } from '../../../shared/application/testing/entity-builder.test-support.js';
import { TestIds } from '../../../shared/application/testing/test-ids.test-support.js';

export type ReceiverPorts = { receivers: ReceiverRepository };

export class ReceiverBuilder extends EntityBuilder<Receiver, ReceiverPorts> {
    private id: string | null = null;
    private name: string | null = null;
    private createdAt = '2026-01-01T00:00:00.000Z';

    withId(id: string): this {
        this.id = id;

        return this;
    }

    withName(name: string): this {
        this.name = name;

        return this;
    }

    withCreatedAt(createdAt: string): this {
        this.createdAt = createdAt;

        return this;
    }

    build(): Receiver {
        return new Receiver({
            id: this.id ?? TestIds.next(),
            name: this.name ?? 'Receiver ' + TestIds.sequence(),
            createdAt: this.createdAt,
        });
    }

    async buildAndSave(ports: ReceiverPorts): Promise<Receiver> {
        const receiver = this.build();

        await ports.receivers.create(receiver);

        return receiver;
    }
}
