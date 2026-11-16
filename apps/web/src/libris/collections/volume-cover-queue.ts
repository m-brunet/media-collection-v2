import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';

export type VolumeCovers = ReadonlyMap<string, VolumeCoverDto>;

export class VolumeCoverQueue {
    static readonly idleWait = 1000;

    private stopped = false;
    private readonly covers = new Map<string, VolumeCoverDto>();

    constructor(
        private readonly wanted: () => readonly string[],
        private readonly ask: (isbn: string) => Promise<VolumeCoverDto>,
        private readonly sleep: (milliseconds: number) => Promise<void>,
        private readonly arrived: (covers: VolumeCovers) => void,
    ) {}

    async run(): Promise<void> {
        while (!this.stopped) {
            const next = this.wanted().find((isbn) => !this.covers.has(isbn));

            if (next === undefined) {
                await this.sleep(VolumeCoverQueue.idleWait);
                continue;
            }

            const reply = await this.ask(next).catch((): VolumeCoverDto => ({ kind: 'none' }));

            if (this.stopped) {
                return;
            }

            this.covers.set(next, reply);
            this.arrived(new Map(this.covers));
        }
    }

    stop(): void {
        this.stopped = true;
    }
}
