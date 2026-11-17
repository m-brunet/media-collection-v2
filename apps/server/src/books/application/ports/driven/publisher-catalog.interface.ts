import type { PublisherUsage } from '../../../domain/value-objects/publisher-names.value-object.js';

export interface PublisherCatalog {
    usages(): Promise<PublisherUsage[]>;
}
