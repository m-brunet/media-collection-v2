import type { InternetAccess } from '../../../domain/entities/internet-access.entity.js';
import type { InternetAccessReader } from './internet-access-reader.interface.js';

export interface InternetAccessStore extends InternetAccessReader {
    save(access: InternetAccess): Promise<void>;
}
