import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { V1Dump } from '../../../../application/ports/driven/v1-dump.interface.js';
import type {
    V1Book,
    V1Category,
    V1Corrections,
} from '../../../../domain/services/v1-library-planner.service.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const categories: readonly V1Category[] = ['books', 'manga', 'comics'];

export class JsonV1Dump implements V1Dump {
    constructor(private readonly source: string) {}

    async read(): Promise<{ books: V1Book[]; corrections: V1Corrections }> {
        const dump = await this.json(this.source);

        if (!Array.isArray(dump)) {
            throw new Error(this.source + ' is not a JSON array of V1 books.');
        }

        return {
            books: dump.map((entry, index) => this.book(entry, index + 1)),
            corrections: {
                isbns: this.isbnCorrections(await this.optional('isbn-corrections.json', [])),
                categories: this.categoryCorrections(
                    await this.optional('category-corrections.json', {}),
                ),
            },
        };
    }

    private book(entry: Json, record: number): V1Book {
        const fields = this.object(entry, 'Record ' + record);
        const label = 'Record ' + record;
        const created = this.decode(fields.created);

        if (typeof created !== 'string') {
            throw new Error(label + ': the creation date is missing.');
        }

        return {
            record,
            title: this.text(fields.title),
            isbn: this.text(fields.isbn),
            authors: Array.isArray(fields.authors)
                ? fields.authors.filter((author) => typeof author === 'string')
                : [],
            type: this.text(fields.type) ?? '',
            bought: fields.bought === true,
            read: this.text(fields.read),
            volume: this.number(fields.volume),
            collectionName: this.text(fields.collectionName),
            lastElement: fields.lastElement === true,
            pageCount: this.number(fields.pageCount),
            price: this.number(fields.price),
            publisher: this.text(fields.publisher),
            cover: this.text(fields.cover),
            created,
        };
    }

    // MongoDB Extended JSON: numbers as { $numberInt | $numberDouble | $numberLong } and dates as
    // { $date: { $numberLong } } or { $date: "<ISO>" }.
    private decode(value: Json | undefined): Json | undefined {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        for (const key of ['$numberInt', '$numberDouble', '$numberLong']) {
            if (typeof value[key] === 'string') {
                return Number(value[key]);
            }
        }

        if ('$date' in value) {
            const date = this.decode(value.$date);
            const time = typeof date === 'number' ? date : Date.parse(String(date));

            return Number.isNaN(time) ? undefined : new Date(time).toISOString();
        }

        return value;
    }

    private text(value: Json | undefined): string | null {
        return typeof value === 'string' ? value : null;
    }

    private number(value: Json | undefined): number | null {
        const decoded = this.decode(value);

        return typeof decoded === 'number' && Number.isFinite(decoded) ? decoded : null;
    }

    private object(value: Json, label: string): { [key: string]: Json } {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(label + ' is not a JSON object.');
        }

        return value;
    }

    private isbnCorrections(value: Json): V1Corrections['isbns'] {
        if (!Array.isArray(value)) {
            throw new Error('isbn-corrections.json must be an array of { record, title, isbn }.');
        }

        return value.map((entry) => {
            const fields = this.object(entry, 'An ISBN correction');

            if (
                typeof fields.record !== 'number' ||
                typeof fields.title !== 'string' ||
                typeof fields.isbn !== 'string'
            ) {
                throw new Error(
                    'Each ISBN correction needs a numeric record, a title and an ISBN.',
                );
            }

            return { record: fields.record, title: fields.title, isbn: fields.isbn };
        });
    }

    private categoryCorrections(value: Json): V1Corrections['categories'] {
        const fields = this.object(value, 'category-corrections.json');

        return Object.entries(fields).map(([collection, category]) => {
            if (!categories.includes(category as V1Category)) {
                throw new Error(
                    'category-corrections.json: "' +
                        collection +
                        '" must be "books", "manga" or "comics".',
                );
            }

            return { collection, category: category as V1Category };
        });
    }

    private async optional(name: string, fallback: Json): Promise<Json> {
        try {
            return await this.json(join(dirname(this.source), name));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return fallback;
            }

            throw error;
        }
    }

    private async json(path: string): Promise<Json> {
        const text = await readFile(path, 'utf8');

        try {
            return JSON.parse(text.replace(/^﻿/, '')) as Json;
        } catch (error) {
            throw new Error(path + ' is not valid JSON.', { cause: error });
        }
    }
}
