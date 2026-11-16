export class StorageSize {
    private static readonly megabyte = 1024 * 1024;

    static format(bytes: number, locale: string): string {
        const megabytes = bytes / StorageSize.megabyte;
        const unit = megabytes >= 1 ? 'megabyte' : 'kilobyte';
        const value = megabytes >= 1 ? megabytes : bytes / 1024;

        return new Intl.NumberFormat(locale, {
            style: 'unit',
            unit,
            maximumFractionDigits: value >= 10 ? 0 : 1,
        }).format(value);
    }
}
