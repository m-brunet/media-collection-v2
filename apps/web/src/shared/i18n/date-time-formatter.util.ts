export class DateTimeFormatter {
    constructor(
        private readonly locale: string,
        private readonly timeZone?: string,
    ) {}

    date(value: string | Date): string {
        return new Intl.DateTimeFormat(this.locale, {
            dateStyle: 'long',
            timeZone: this.timeZone,
        }).format(new Date(value));
    }

    // Exact moment with the time-zone label, for example "1 November 2026, 13:42 CET".
    dateTime(value: string | Date): string {
        return new Intl.DateTimeFormat(this.locale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: this.timeZone,
        })
            .format(new Date(value))
            .concat(' ', this.zoneLabel(value));
    }

    // Exact moment for timestamp details, for example "1 November 2026 · 13:42 (CET)".
    exact(value: string | Date): string {
        const time = new Intl.DateTimeFormat(this.locale, {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: this.timeZone,
        }).format(new Date(value));

        return this.date(value) + ' · ' + time + ' (' + this.zoneLabel(value) + ')';
    }

    private zoneLabel(value: string | Date): string {
        const parts = new Intl.DateTimeFormat(this.locale, {
            timeZoneName: 'short',
            timeZone: this.timeZone,
        }).formatToParts(new Date(value));

        return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    }
}
