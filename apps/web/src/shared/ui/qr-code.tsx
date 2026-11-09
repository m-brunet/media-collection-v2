import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// A QR code drawn on this computer (the address never leaves it), with the Libris mark in the
// centre. The highest error correction (H, about 30 % recoverable) lets phones read the modules
// the mark covers; the white margin around the code is the quiet zone scanners need.
export function QrCode({ value, label }: { value: string; label: string }) {
    const [picture, setPicture] = useState<string | null>(null);

    useEffect(() => {
        let current = true;

        void QRCode.toString(value, { type: 'svg', margin: 4, errorCorrectionLevel: 'H' }).then(
            (svg) => {
                if (current) {
                    setPicture('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
                }
            },
        );

        return () => {
            current = false;
        };
    }, [value]);

    if (!picture) {
        return null;
    }

    return (
        <div className="qr-code" role="img" aria-label={label}>
            <img className="qr-code__matrix" src={picture} alt="" />
            <span className="qr-code__mark">
                <img src="/libris.svg" alt="" />
            </span>
        </div>
    );
}
