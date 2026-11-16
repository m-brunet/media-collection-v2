import { describe, expect, it } from 'vitest';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { ManualClock, ScriptedSource } from '../testing/book-doubles.test-support.js';
import type { SourceRecipient, SourceUnavailability } from './source-chain.service.js';
import { SourceLink } from './source-chain.service.js';

const never = new Promise<'late'>(() => undefined);
const found = (value: string): SourceReply<string> => ({ kind: 'found', value });

function chain(...sources: ScriptedSource<string>[]) {
    return SourceLink.chain(sources, new ManualClock())!;
}

function recorder() {
    const events: string[] = [];
    const recipient: SourceRecipient<string> = {
        found: (source, value) => events.push(source + ':' + value),
        unavailable: ({ source, reason }: SourceUnavailability) =>
            events.push(source + ':' + reason),
        late: (source) => events.push(source + ':late'),
    };

    return { events, recipient };
}

describe('SourceLink', () => {
    it('hands every answer over in order of preference', async () => {
        const link = chain(
            new ScriptedSource('bnf', found('a')),
            new ScriptedSource('ol', found('b')),
        );
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, never);

        expect(events).toEqual(['bnf:a', 'ol:b']);
    });

    it('asks every source at once, before the first one answers', () => {
        const first = new ScriptedSource<string>('bnf', 'hang');
        const second = new ScriptedSource('ol', found('b'));

        chain(first, second).begin('9782253164692');

        expect(second.asked).toEqual(['9782253164692']);
    });

    it('asks a single-book lookup ahead of bulk work', () => {
        const source = new ScriptedSource('bnf', found('a'));

        chain(source).begin('9782253164692');

        expect(source.turns).toEqual([{ bulk: false }]);
    });

    it('passes the lookup on when a source has nothing', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', { kind: 'none' }),
            new ScriptedSource('ol', found('b')),
        );
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, never);

        expect(events).toEqual(['ol:b']);
    });

    it('reports a failing source and continues (example 20)', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', 'fail'),
            new ScriptedSource('ol', found('b')),
        );
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, never);

        expect(events).toEqual(['bnf:failed', 'ol:b']);
    });

    it('reports a source that asked to wait (example 20)', async () => {
        const link = chain(new ScriptedSource<string>('bnf', { kind: 'limited', retryAt: null }));
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, never);

        expect(events).toEqual(['bnf:limited']);
    });

    it('reports a source whose queue is too long as busy', async () => {
        const link = chain(new ScriptedSource<string>('bnf', { kind: 'busy' }));
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, never);

        expect(events).toEqual(['bnf:busy']);
    });

    it('names a source that has not answered by the deadline and continues', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', 'hang'),
            new ScriptedSource('ol', found('b')),
        );
        const { events, recipient } = recorder();

        await link.begin('9782253164692').handle(recipient, Promise.resolve('late'));

        expect(events).toEqual(['bnf:late', 'ol:b']);
    });

    it('gives an answer that arrived before the deadline passed', async () => {
        const link = chain(new ScriptedSource('bnf', found('a')));
        const { events, recipient } = recorder();

        await link.first('9782253164692', false);

        await link.begin('9782253164692').handle(recipient, Promise.resolve('late'));

        expect(events).toEqual(['bnf:a']);
    });

    it('asks for one ISBN as bulk work when told so', async () => {
        const source = new ScriptedSource('bnf', found('a'));

        const value = await chain(source).first('9782253164692', true);

        expect(value).toBe('a');
        expect(source.turns).toEqual([{ bulk: true }]);
    });

    it('gives the answer of the preferred source without asking the next one', async () => {
        const second = new ScriptedSource('ol', found('b'));

        const value = await chain(new ScriptedSource('bnf', found('a')), second).first(
            '9782253164692',
            true,
        );

        expect(value).toBe('a');
        expect(second.asked).toEqual([]);
    });

    it('asks the next source when the preferred one has nothing', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', { kind: 'none' }),
            new ScriptedSource('ol', found('b')),
        );

        const value = await link.first('9782253164692', true);

        expect(value).toBe('b');
    });

    it('asks the next source when the preferred one cannot answer', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', 'fail'),
            new ScriptedSource('ol', found('b')),
        );

        const value = await link.first('9782253164692', true);

        expect(value).toBe('b');
    });

    it('gives nothing when no source has an answer', async () => {
        const link = chain(
            new ScriptedSource<string>('bnf', { kind: 'none' }),
            new ScriptedSource<string>('ol', { kind: 'busy' }),
        );

        const value = await link.first('9782253164692', true);

        expect(value).toBeNull();
    });
});

describe('SourceLink.chain', () => {
    it('keeps the answers of each source across lookups', async () => {
        const source = new ScriptedSource('bnf', found('a'));
        const link = chain(source);

        await link.begin('9782253164692').handle(recorder().recipient, never);

        await link.begin('9782253164692').handle(recorder().recipient, never);

        expect(source.requests).toHaveLength(1);
    });

    it('is empty without sources', () => {
        const link = SourceLink.chain<string>([], new ManualClock());

        expect(link).toBeNull();
    });
});
