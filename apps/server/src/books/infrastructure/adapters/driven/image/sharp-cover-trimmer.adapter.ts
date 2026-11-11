import sharp from 'sharp';
import type { CoverTrimmer } from '../../../../application/ports/driven/cover-trimmer.interface.js';
import { CoverPadding } from '../../../../domain/services/cover-padding.service.js';
import { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';

export class SharpCoverTrimmer implements CoverTrimmer {
    static readonly quality = 90;

    async trim(cover: CoverImage): Promise<CoverImage> {
        try {
            // Orientation recorded in the file is applied first, so the box matches what people see.
            const { data, info } = await sharp(cover.bytes)
                .autoOrient()
                .raw()
                .toBuffer({ resolveWithObject: true });
            const box = CoverPadding.measure({
                width: info.width,
                height: info.height,
                channels: info.channels,
                data,
            });

            if (!box) {
                return cover;
            }

            const cropped = sharp(cover.bytes).autoOrient().extract(box);
            const encoded =
                cover.mediaType === 'image/png'
                    ? cropped.png()
                    : cover.mediaType === 'image/webp'
                      ? cropped.webp({ quality: SharpCoverTrimmer.quality })
                      : cropped.jpeg({ quality: SharpCoverTrimmer.quality });

            return CoverImage.from(new Uint8Array(await encoded.toBuffer()));
        } catch {
            // Justified: the cover already passed `CoverImage`; one that cannot be decoded here is
            // stored as provided rather than lost.
            return cover;
        }
    }
}
