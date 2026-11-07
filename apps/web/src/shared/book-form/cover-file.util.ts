// The pictures a book form accepts as a cover, before the server checks them again.
export class CoverFile {
    static readonly types = ['image/jpeg', 'image/png', 'image/webp'];
    static readonly limit = 10 * 1024 * 1024;

    // Why the picture cannot be a cover, or null when it can.
    static problem(file: Blob): 'format' | 'size' | null {
        if (!CoverFile.types.includes(file.type)) {
            return 'format';
        }

        return file.size > CoverFile.limit ? 'size' : null;
    }
}
