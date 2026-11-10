export class BackupFileName {
    static readonly extension = 'mcbackup';

    static at(date: Date): string {
        const pad = (value: number) => String(value).padStart(2, '0');
        const day = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
        const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
            '-',
        );

        return 'Media Collection backup ' + day + ' ' + time + '.' + BackupFileName.extension;
    }
}
