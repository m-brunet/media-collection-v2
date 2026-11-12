import { useEffect, useState } from 'react';
import type { PairingLink } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';

const pairingLifetime = 2 * 60 * 1000;

export function usePairingLink(address: string | null): {
    ready: boolean;
    link: PairingLink | null;
} {
    const [result, setResult] = useState<{ address: string; link: PairingLink | null } | null>(
        null,
    );

    useEffect(() => {
        if (!address) {
            return;
        }

        let current = true;
        let timer: number | undefined;
        const request = () =>
            void api
                .request<PairingLink>('/auth/pairing-codes', {
                    method: 'POST',
                    body: { address },
                })
                .then(
                    (link) => {
                        if (!current) {
                            return;
                        }

                        setResult({ address, link });
                        timer = window.setTimeout(
                            request,
                            Math.min(pairingLifetime, Date.parse(link.expiresAt) - Date.now()),
                        );
                    },
                    () => {
                        if (current) {
                            setResult({ address, link: null });
                        }
                    },
                );

        request();

        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [address]);

    return address && result?.address === address
        ? { ready: true, link: result.link }
        : { ready: !address, link: null };
}
