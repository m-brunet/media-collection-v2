import type { DomainName } from '../../../domain/value-objects/domain-name.value-object.js';
import type { DomainNameReader } from './domain-name-reader.interface.js';

export interface DomainNameStore extends DomainNameReader {
    save(name: DomainName | null): Promise<void>;
}
