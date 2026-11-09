import type { Locator } from 'playwright';
import { readBarcodes } from 'zxing-wasm/reader';

// Reads the QR code shown by `code` the way a phone camera would: from its picture on screen,
// Libris mark included.
export async function readQrCode(code: Locator): Promise<string[]> {
    const picture = await code.screenshot();
    const results = await readBarcodes(new Blob([new Uint8Array(picture)]), {
        formats: ['QRCode'],
    });

    return results.map((result) => result.text);
}
