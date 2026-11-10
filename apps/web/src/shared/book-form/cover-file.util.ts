export class CoverFile {
    static readonly types = ['image/jpeg', 'image/png', 'image/webp'];
    static readonly limit = 10 * 1024 * 1024;

    static problem(file: Blob): 'format' | 'size' | null {
        if (!CoverFile.types.includes(file.type)) {
            return 'format';
        }

        return file.size > CoverFile.limit ? 'size' : null;
    }
}
