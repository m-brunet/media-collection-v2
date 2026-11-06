// A cover a source offers: where to fetch it, its size when known, and a fingerprint of the
// picture (equal fingerprints: the same cover, whatever its size or address).
export interface CoverOffer {
    address: string;
    width: number | null;
    height: number | null;
    fingerprint: string | null;
}

export interface CoverChoice {
    address: string;
    width: number | null;
    height: number | null;
    sources: string[];
}

// Combines the covers of several sources, added in order of preference (book entry rules,
// "Lookup sources"): very small thumbnails are not offered, and the same picture offered by
// several sources is shown once, at its best resolution, where it first appeared.
export class CoverCombination {
    // Thumbnails shorter than this are too small to make a cover.
    static readonly minimumHeight = 300;

    private readonly choices: (CoverChoice & { fingerprint: string | null })[] = [];

    add(source: string, offers: readonly CoverOffer[]): void {
        for (const offer of offers) {
            if (offer.height !== null && offer.height < CoverCombination.minimumHeight) {
                continue;
            }

            const same = offer.fingerprint
                ? this.choices.find((choice) => choice.fingerprint === offer.fingerprint)
                : this.choices.find((choice) => choice.address === offer.address);

            if (!same) {
                this.choices.push({
                    address: offer.address,
                    width: offer.width,
                    height: offer.height,
                    fingerprint: offer.fingerprint,
                    sources: [source],
                });
                continue;
            }

            if (!same.sources.includes(source)) {
                same.sources.push(source);
            }

            if (CoverCombination.area(offer) > CoverCombination.area(same)) {
                same.address = offer.address;
                same.width = offer.width;
                same.height = offer.height;
            }
        }
    }

    result(): CoverChoice[] {
        return this.choices.map(({ address, width, height, sources }) => ({
            address,
            width,
            height,
            sources: [...sources],
        }));
    }

    private static area(cover: { width: number | null; height: number | null }): number {
        return (cover.width ?? 0) * (cover.height ?? 0);
    }
}
