import { describe, expect, it } from 'vitest';
import { StorageSize } from './storage-size.util';

describe('StorageSize', () => {
    it('writes a large size in megabytes, without decimals', () => {
        const text = StorageSize.format(52 * 1024 * 1024, 'en-GB');

        expect(text).toBe('52 MB');
    });

    it('keeps one decimal under ten megabytes', () => {
        const text = StorageSize.format(2.5 * 1024 * 1024, 'en-GB');

        expect(text).toBe('2.5 MB');
    });

    it('writes a size under one megabyte in kilobytes', () => {
        const text = StorageSize.format(180 * 1024, 'en-GB');

        expect(text).toBe('180 kB');
    });

    it('writes nothing stored as zero kilobytes', () => {
        const text = StorageSize.format(0, 'en-GB');

        expect(text).toBe('0 kB');
    });

    it('uses the French unit and decimal comma', () => {
        const text = StorageSize.format(2.5 * 1024 * 1024, 'fr-FR');

        expect(text.replace(/\s/g, ' ')).toBe('2,5 Mo');
    });
});
