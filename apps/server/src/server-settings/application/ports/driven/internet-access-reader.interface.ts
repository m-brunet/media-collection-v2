import type { InternetAccess } from '../../../domain/entities/internet-access.entity.js';

export interface InternetAccessReader {
    read(): Promise<InternetAccess>;
}
