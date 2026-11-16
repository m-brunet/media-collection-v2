import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';

export type VolumeCovers = ReadonlyMap<string, VolumeCoverDto>;

export class VolumeCoverQueue {
    static readonly idleWait = 1000;
    static readonly together = 10;

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
            const next = this.wanted()
                .filter((isbn) => !this.covers.has(isbn))
                .slice(0, VolumeCoverQueue.together);

            if (next.length === 0) {
                await this.sleep(VolumeCoverQueue.idleWait);
                continue;
            }

            await Promise.all(next.map((isbn) => this.fetch(isbn)));
        }
    }

    stop(): void {
        this.stopped = true;
    }

    private async fetch(isbn: string): Promise<void> {
        const reply = await this.ask(isbn).catch((): VolumeCoverDto => ({ kind: 'none' }));

        if (this.stopped) {
            return;
        }

        this.covers.set(isbn, reply);
        this.arrived(new Map(this.covers));
    }
}
