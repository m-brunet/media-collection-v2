// Says how long ago a UTC moment was, in the viewer's language and time zone, with the browser's
// own wording, starting with a capital ("12 minutes ago", "Yesterday", "Il y a 2 semaines").
// Under a minute it gives `justNow`. Past the same calendar day it counts calendar days in the
// viewer's time zone, so something done at 23:00 is "Yesterday" the next morning, not "9 hours ago".
export class RelativeTime {
    private readonly words: Intl.RelativeTimeFormat;

    constructor(
        private readonly locale: string,
        private readonly justNow: string,
        private readonly timeZone?: string,
    ) {
        this.words = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    }

    of(value: string | Date, now: Date): string {
        const phrase = this.phrase(new Date(value), now);

        return phrase.charAt(0).toLocaleUpperCase(this.locale) + phrase.slice(1);
    }

    private phrase(then: Date, now: Date): string {
        const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
        const minutes = Math.floor(seconds / 60);
        const days = this.calendarDays(then, now);

        if (minutes < 1) {
            return this.justNow;
        }

        if (minutes < 60) {
            return this.words.format(-minutes, 'minute');
        }

        if (days === 0) {
            return this.words.format(-Math.floor(minutes / 60), 'hour');
        }

        if (days < 7) {
            return this.words.format(-days, 'day');
        }

        if (days < 30) {
            return this.words.format(-Math.floor(days / 7), 'week');
        }

        const months = this.calendarMonths(then, now);

        if (months < 12) {
            return this.words.format(-Math.max(1, months), 'month');
        }

        return this.words.format(-Math.floor(months / 12), 'year');
    }

    // Whole calendar days between the two dates in the viewer's time zone.
    private calendarDays(then: Date, now: Date): number {
        return Math.round((this.day(now) - this.day(then)) / 86_400_000);
    }

    // Whole calendar months, not counting the current one until its day of the month is reached.
    private calendarMonths(then: Date, now: Date): number {
        const [fromYear, fromMonth, fromDay] = this.parts(then);
        const [toYear, toMonth, toDay] = this.parts(now);
        const months = (toYear - fromYear) * 12 + (toMonth - fromMonth);

        return toDay < fromDay ? months - 1 : months;
    }

    private day(value: Date): number {
        const [year, month, day] = this.parts(value);

        return Date.UTC(year, month - 1, day);
    }

    private parts(value: Date): [number, number, number] {
        const parts = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: this.timeZone,
        }).formatToParts(value);
        const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);

        return [part('year'), part('month'), part('day')];
    }
}
