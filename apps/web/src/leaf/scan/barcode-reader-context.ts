import { createContext, useContext } from 'react';
import { ZxingBarcodeReader } from './zxing-barcode-reader.adapter';

// Reads the EAN-13 barcodes visible in a camera frame or a photo, on the phone itself. Nothing
// leaves the device: only the ISBN found is used afterwards.
export interface BarcodeReader {
    // The raw values of the EAN-13 barcodes found; empty when there is none.
    read(source: HTMLVideoElement | Blob): Promise<string[]>;
}

// The production reader; component tests provide a scripted one.
export const BarcodeReaderContext = createContext<BarcodeReader>(new ZxingBarcodeReader());

export function useBarcodeReader(): BarcodeReader {
    return useContext(BarcodeReaderContext);
}
