import type { NoteReader } from './note-reader.interface.js';
import type { NoteWriter } from './note-writer.interface.js';

export interface NoteRepository extends NoteReader, NoteWriter {}
