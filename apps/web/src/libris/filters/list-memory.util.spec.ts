import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListMemory } from './list-memory.util';

class MemoryStorage {
    readonly values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

function storage(store: object = new MemoryStorage()) {
    vi.stubGlobal('window', { localStorage: store });

    return store;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ListMemory choices', () => {
    it('keeps the filters and the sort of My books, without the search', () => {
        const parameters = new URLSearchParams('search=dune&category=manga&sort=title-desc&page=2');

        const choices = ListMemory.choices('books', parameters, false);

        expect(choices.toString()).toBe('category=manga&sort=title-desc');
    });

    it('keeps the filters, the direction and the status of Collections, without a collection', () => {
        const parameters = new URLSearchParams(
            'collection=c1&ownership=owned&direction=desc&finished=false',
        );

        const choices = ListMemory.choices('collections', parameters, false);

        expect(choices.toString()).toBe('ownership=owned&direction=desc&finished=false');
    });

    it('keeps the Dropped choice of Collections', () => {
        const parameters = new URLSearchParams('dropped=true&finished=true');

        const choices = ListMemory.choices('collections', parameters, false);

        expect(choices.toString()).toBe('dropped=true&finished=true');
    });

    it('drops a Dropped choice left in the address of My books', () => {
        const parameters = new URLSearchParams('dropped=true&category=manga');

        const choices = ListMemory.choices('books', parameters, false);

        expect(choices.toString()).toBe('category=manga');
    });

    it('drops unknown values', () => {
        const parameters = new URLSearchParams('category=poems&sort=price-asc');

        const choices = ListMemory.choices('books', parameters, false);

        expect(choices.toString()).toBe('');
    });

    it('drops the reading filter of a Guest', () => {
        const parameters = new URLSearchParams('reading=unread&ownership=owned');

        const choices = ListMemory.choices('books', parameters, true);

        expect(choices.toString()).toBe('ownership=owned');
    });
});

describe('ListMemory recognizes', () => {
    it('recognizes a choice or a search of the list in the address', () => {
        const addresses = ['search=dune', 'tag=t1', 'sort=title-desc', 'finished=true'];

        const recognized = addresses.map((address) =>
            ListMemory.recognizes('collections', new URLSearchParams(address)),
        );

        expect(recognized).toEqual([true, true, false, true]);
    });

    it('ignores the parameters that are not list choices', () => {
        const recognized = ListMemory.recognizes('books', new URLSearchParams('view=grid'));

        expect(recognized).toBe(false);
    });
});

describe('ListMemory storage', () => {
    it('gives back the choices written for an account and a list', () => {
        storage();
        ListMemory.write('alex', 'books', new URLSearchParams('category=manga&sort=title-desc'));

        const read = ListMemory.read('alex', 'books', false);

        expect(read?.toString()).toBe('category=manga&sort=title-desc');
    });

    it('keeps the accounts and the lists apart', () => {
        storage();
        ListMemory.write('alex', 'books', new URLSearchParams('category=manga'));

        const read = [
            ListMemory.read('sam', 'books', false),
            ListMemory.read('alex', 'collections', false),
        ];

        expect(read).toEqual([null, null]);
    });

    it('remembers an empty selection', () => {
        storage();
        ListMemory.write('alex', 'books', new URLSearchParams());

        const read = ListMemory.read('alex', 'books', false);

        expect(read?.toString()).toBe('');
    });

    it('applies the Guest rules to what it gives back', () => {
        storage();
        ListMemory.write('morgan', 'books', new URLSearchParams('reading=read&category=books'));

        const read = ListMemory.read('morgan', 'books', true);

        expect(read?.toString()).toBe('category=books');
    });

    it.each([
        ['broken JSON', '{'],
        ['another version', JSON.stringify({ version: 2, choices: 'category=manga' })],
        ['no choices', JSON.stringify({ version: 1 })],
    ])('ignores a record with %s', (_, record) => {
        const store = storage() as MemoryStorage;

        store.setItem('media-collection.list-choices.books.alex', record);

        const read = ListMemory.read('alex', 'books', false);

        expect(read).toBeNull();
    });

    it('carries on when the browser refuses storage', () => {
        storage({
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
        });

        const outcome = () => {
            ListMemory.write('alex', 'books', new URLSearchParams('category=manga'));

            return ListMemory.read('alex', 'books', false);
        };

        expect(outcome()).toBeNull();
    });
});
