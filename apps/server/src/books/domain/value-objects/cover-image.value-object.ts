import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type CoverMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

// An uploaded cover: a JPEG, PNG or WebP image of at most 10 MB, recognised by its content
// rather than by the type its sender claims.
export class CoverImage {
    static readonly maximumBytes = 10 * 1024 * 1024;

    private constructor(
        readonly bytes: Uint8Array,
        readonly mediaType: CoverMediaType,
    ) {
        Object.freeze(this);
    }

    static from(bytes: Uint8Array): CoverImage {
        Failure.ensure(
            bytes.length > 0 && bytes.length <= CoverImage.maximumBytes,
            'Choose an image of at most 10 MB.',
            'cover-too-large',
        );

        const mediaType = CoverImage.detect(bytes);

        Failure.ensure(mediaType, 'Choose a JPEG, PNG or WebP image.', 'cover-format');

        return new CoverImage(bytes, mediaType);
    }

    private static detect(bytes: Uint8Array): CoverMediaType | null {
        const starts = (...values: number[]) =>
            values.every((value, index) => bytes[index] === value);
        const text = (offset: number, value: string) =>
            [...value].every(
                (character, index) => bytes[offset + index] === character.charCodeAt(0),
            );

        if (starts(0xff, 0xd8, 0xff)) {
            return 'image/jpeg';
        }

        if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
            return 'image/png';
        }

        return text(0, 'RIFF') && text(8, 'WEBP') ? 'image/webp' : null;
    }
}
