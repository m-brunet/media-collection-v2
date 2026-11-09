import type { HttpInternetAccess } from '../../../domain/entities/http-internet-access.entity.js';
import type { HttpInternetAccessReader } from './http-internet-access-reader.interface.js';

export interface HttpInternetAccessStore extends HttpInternetAccessReader {
    save(access: HttpInternetAccess): Promise<void>;
}
