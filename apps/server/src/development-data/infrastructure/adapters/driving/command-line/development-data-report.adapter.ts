import type { V1ImportReport } from '../../../../application/ports/driving/import-v1-library-use-case.interface.js';
import type { ResetReport } from '../../../../application/ports/driving/reset-development-data-use-case.interface.js';

export class DevelopmentDataReport {
    static importing(source: string): string {
        return 'Checking ' + source + ' and fetching its covers…';
    }

    static reset(dataDirectory: string, report: ResetReport): string[] {
        return [
            'Development library emptied in ' + dataDirectory + '.',
            'Deleted ' +
                report.books +
                ' books, ' +
                report.authors +
                ' authors, ' +
                report.collections +
                ' collections, ' +
                report.loans +
                ' loans and ' +
                report.removedCoverFiles +
                ' cover files.',
            'Accounts and server settings were kept; every session was signed out.',
        ];
    }

    static importV1(dataDirectory: string, report: V1ImportReport): string[] {
        return [
            'Development library in ' + dataDirectory + ' replaced by the V1 dump.',
            'Removed the previous ' +
                report.erased.books +
                ' books, ' +
                report.erased.collections +
                ' collections and ' +
                report.erased.loans +
                ' loans; accounts and server settings were kept.',
            'Imported ' +
                report.books +
                ' books in ' +
                report.collections +
                ' collections, with ' +
                report.coversStored +
                ' covers.',
            'Marked Finished: ' +
                (report.finished.length ? report.finished.join(', ') : 'none') +
                '.',
            ...report.unfinished.map(
                (collection) =>
                    'Left unfinished: ' +
                    collection.name +
                    ' (last volume ' +
                    collection.lastVolume +
                    (collection.missing.length
                        ? '; missing ' + collection.missing.join(', ')
                        : '') +
                    (collection.beyond.length
                        ? '; beyond it ' + collection.beyond.join(', ')
                        : '') +
                    ').',
            ),
            ...report.titled.map(
                (book) =>
                    'Untitled Book, record ' +
                    book.record +
                    ': saved with the title "' +
                    book.title +
                    '".',
            ),
            ...report.coversSkipped.map(
                (skipped) =>
                    'No cover for record ' +
                    skipped.record +
                    ' (' +
                    skipped.title +
                    '): ' +
                    (skipped.reason === 'unusable'
                        ? 'not a JPEG, PNG or WebP image.'
                        : 'could not be downloaded.'),
            ),
        ];
    }
}
