import { createContext, useContext } from 'react';
import { ZxingBarcodeReader } from './zxing-barcode-reader.adapter';

export interface BarcodeReader {
    read(source: HTMLVideoElement | Blob): Promise<string[]>;
}

export const BarcodeReaderContext = createContext<BarcodeReader>(new ZxingBarcodeReader());

export function useBarcodeReader(): BarcodeReader {
    return useContext(BarcodeReaderContext);
}
