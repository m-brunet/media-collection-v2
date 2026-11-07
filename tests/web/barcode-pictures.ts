import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer';

const require = createRequire(import.meta.url);
const writerWasm = readFileSync(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));

prepareZXingModule({
    overrides: {
        wasmBinary: writerWasm.buffer.slice(
            writerWasm.byteOffset,
            writerWasm.byteOffset + writerWasm.byteLength,
        ),
    },
});

// Pictures of a book's EAN-13 barcode, standing in for the phone camera in browser journeys: a
// photo for the camera-app path, and a video file for Chromium's fake camera. Leaf's real
// barcode reader then reads them. Generated on the fly; no picture is committed.
export class BarcodePictures {
    // A PNG of the barcode on a white margin, like a photo of the back cover.
    static async photo(isbn: string): Promise<Buffer> {
        const written = await writeBarcode(isbn, { format: 'EAN13', scale: 4 });

        return sharp(Buffer.from(written.svg))
            .flatten({ background: '#ffffff' })
            .extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#ffffff' })
            .png()
            .toBuffer();
    }

    // A one-frame YUV4MPEG2 video (640 × 480) of the barcode, written in `directory`, for
    // `--use-file-for-fake-video-capture`.
    static async video(isbn: string, directory: string): Promise<string> {
        const width = 640;
        const height = 480;
        const pixels = await sharp({
            create: { width, height, channels: 3, background: '#ffffff' },
        })
            .composite([{ input: await BarcodePictures.photo(isbn), gravity: 'centre' }])
            // Three bytes per pixel, as the conversion below reads them.
            .removeAlpha()
            .raw()
            .toBuffer();
        const path = join(directory, 'barcode-' + isbn + '.y4m');

        writeFileSync(
            path,
            Buffer.concat([
                Buffer.from('YUV4MPEG2 W' + width + ' H' + height + ' F30:1 Ip A1:1 C420jpeg\n'),
                Buffer.from('FRAME\n'),
                BarcodePictures.i420(pixels, width, height),
            ]),
        );

        return path;
    }

    // RGB to the planar 4:2:0 YUV of the video format (BT.601, full range).
    private static i420(rgb: Buffer, width: number, height: number): Buffer {
        const luma = Buffer.alloc(width * height);
        const chroma = (width / 2) * (height / 2);
        const u = Buffer.alloc(chroma);
        const v = Buffer.alloc(chroma);
        const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const at = (y * width + x) * 3;
                const [r, g, b] = [rgb[at]!, rgb[at + 1]!, rgb[at + 2]!];

                luma[y * width + x] = clamp(0.299 * r + 0.587 * g + 0.114 * b);

                if (y % 2 === 0 && x % 2 === 0) {
                    const index = (y / 2) * (width / 2) + x / 2;

                    u[index] = clamp(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
                    v[index] = clamp(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
                }
            }
        }

        return Buffer.concat([luma, u, v]);
    }
}
