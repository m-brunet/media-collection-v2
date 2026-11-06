// The title a Manga or Comics book takes from its collection when no title is supplied:
// `Name Vol. N` for one volume, `Name Vol. N–M` (en dash) for a consecutive range. The collection's
// display name is used as shown; `Vol.` is the same in every interface language.
export class GeneratedTitle {
    private constructor(readonly text: string) {}

    static of(collectionName: string, volumeFrom: number, volumeTo: number): GeneratedTitle {
        const volumes = volumeTo > volumeFrom ? volumeFrom + '–' + volumeTo : String(volumeFrom);

        return new GeneratedTitle(collectionName.trim() + ' Vol. ' + volumes);
    }
}
