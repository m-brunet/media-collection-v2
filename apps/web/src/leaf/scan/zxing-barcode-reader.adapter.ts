import readerWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { BarcodeReader } from './barcode-reader-context';

interface Detector {
    detect(source: HTMLVideoElement | Blob): Promise<{ format: string; rawValue: string }[]>;
}

interface DetectorClass {
    new (options: { formats: string[] }): Detector;
    getSupportedFormats(): Promise<string[]>;
}

// Barcode reading with the browser's own detector when it reads EAN-13 (Android Chrome), and
// otherwise ZXing-C++ compiled to WebAssembly (`barcode-detector`, MIT; `zxing-wasm`, MIT). The
// WebAssembly file is bundled with Leaf and served by the app itself, never from a CDN, so
// scanning works without internet access.
export class ZxingBarcodeReader implements BarcodeReader {
    private detector: Promise<Detector> | undefined;

    async read(source: HTMLVideoElement | Blob): Promise<string[]> {
        this.detector ??= this.create();
        const found = await (await this.detector).detect(source);

        return found.filter((code) => code.format === 'ean_13').map((code) => code.rawValue);
    }

    private async create(): Promise<Detector> {
        const native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;

        if (native && (await native.getSupportedFormats()).includes('ean_13')) {
            return new native({ formats: ['ean_13'] });
        }

        const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');

        prepareZXingModule({
            overrides: {
                locateFile: (path: string, prefix: string) =>
                    path.endsWith('.wasm') ? readerWasm : prefix + path,
            },
        });

        return new BarcodeDetector({ formats: ['ean_13'] });
    }
}
