import { useEffect, useRef, useState } from 'react';
import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { VolumeCovers } from './volume-cover-queue';
import { VolumeCoverQueue } from './volume-cover-queue';

export function useVolumeCovers(wanted: readonly string[]): VolumeCovers {
    const [covers, setCovers] = useState<VolumeCovers>(() => new Map());
    const current = useRef(wanted);

    useEffect(() => {
        current.current = wanted;
    }, [wanted]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const queue = new VolumeCoverQueue(
            () => current.current,
            (isbn) =>
                api.request<VolumeCoverDto>('/books/lookups/volume-cover', {
                    method: 'POST',
                    body: { isbn },
                    passive: true,
                }),
            (milliseconds) =>
                new Promise((resolve) => {
                    timer = setTimeout(resolve, milliseconds);
                }),
            () => Date.now(),
            setCovers,
        );

        void queue.run();

        return () => {
            queue.stop();
            clearTimeout(timer);
        };
    }, []);

    return covers;
}
