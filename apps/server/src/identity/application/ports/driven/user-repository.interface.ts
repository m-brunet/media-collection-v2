import type { UserReader } from './user-reader.interface.js';
import type { UserWriter } from './user-writer.interface.js';

export interface UserRepository extends UserReader, UserWriter {}
