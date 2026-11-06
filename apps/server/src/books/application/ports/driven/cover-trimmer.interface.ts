import type { CoverImage } from '../../../domain/value-objects/cover-image.value-object.js';

// Removes shop padding from a cover before it is stored. A cover without such padding, or one the
// trimmer cannot read, comes back unchanged.
export interface CoverTrimmer {
    trim(cover: CoverImage): Promise<CoverImage>;
}
