export class BackupFileName {
    static readonly extension = 'mcbackup';

    // `before`: the version an update is about to install.
    static at(date: Date, before?: string): string {
        const pad = (value: number) => String(value).padStart(2, '0');
        const day = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
        const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
            '-',
        );
        const suffix = before ? ' before ' + before : '';

        return (
            'Media Collection backup ' + day + ' ' + time + suffix + '.' + BackupFileName.extension
        );
    }
}
