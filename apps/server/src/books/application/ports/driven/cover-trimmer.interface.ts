import type { CoverImage } from '../../../domain/value-objects/cover-image.value-object.js';

export interface CoverTrimmer {
    trim(cover: CoverImage): Promise<CoverImage>;
}
