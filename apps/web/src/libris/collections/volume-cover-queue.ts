import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';

export type VolumeCoverState = Exclude<VolumeCoverDto, { kind: 'limited' }>;

export type VolumeCovers = ReadonlyMap<string, VolumeCoverState>;

export class VolumeCoverQueue {
    static readonly spacing = 6000;
    static readonly fallbackWait = 180000;

    private stopped = false;
    private readonly covers = new Map<string, VolumeCoverState>();

    constructor(
        private readonly wanted: () => readonly string[],
        private readonly ask: (isbn: string) => Promise<VolumeCoverDto>,
        private readonly sleep: (milliseconds: number) => Promise<void>,
        private readonly now: () => number,
        private readonly arrived: (covers: VolumeCovers) => void,
    ) {}

    async run(): Promise<void> {
        while (!this.stopped) {
            const next = this.wanted().find((isbn) => !this.covers.has(isbn));

            if (next === undefined) {
                await this.sleep(VolumeCoverQueue.spacing);
                continue;
            }

            const reply = await this.ask(next).catch((): VolumeCoverDto => ({ kind: 'none' }));

            if (this.stopped) {
                return;
            }

            if (reply.kind === 'limited') {
                await this.sleep(this.waitUntil(reply.retryAt));
                continue;
            }

            this.covers.set(next, reply);
            this.arrived(new Map(this.covers));
            await this.sleep(VolumeCoverQueue.spacing);
        }
    }

    stop(): void {
        this.stopped = true;
    }

    private waitUntil(retryAt: string): number {
        const at = Date.parse(retryAt);

        return Number.isNaN(at)
            ? VolumeCoverQueue.fallbackWait
            : Math.max(VolumeCoverQueue.spacing, at - this.now());
    }
}
