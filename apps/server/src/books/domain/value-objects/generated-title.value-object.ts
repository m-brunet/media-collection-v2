export class GeneratedTitle {
    private constructor(readonly text: string) {}

    static of(collectionName: string, volumeFrom: number, volumeTo: number): GeneratedTitle {
        const volumes = volumeTo > volumeFrom ? volumeFrom + '–' + volumeTo : String(volumeFrom);

        return new GeneratedTitle(collectionName.trim() + ' Vol. ' + volumes);
    }
}
