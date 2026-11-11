import type { Locator } from 'playwright';
import { readBarcodes } from 'zxing-wasm/reader';

export async function readQrCode(code: Locator): Promise<string[]> {
    const picture = await code.screenshot();
    const results = await readBarcodes(new Blob([new Uint8Array(picture)]), {
        formats: ['QRCode'],
    });

    return results.map((result) => result.text);
}
