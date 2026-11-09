import type { HttpInternetAccess } from '../../../domain/entities/http-internet-access.entity.js';

export interface HttpInternetAccessReader {
    read(): Promise<HttpInternetAccess>;
}
