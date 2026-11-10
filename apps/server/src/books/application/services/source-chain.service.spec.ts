import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { ManualClock, ScriptedSource } from '../testing/book-doubles.test-support.js';
import { SourceBudget } from './source-budget.service.js';
import type { SourceRecipient, SourceUnavailability } from './source-chain.service.js';
import { SourceLink } from './source-chain.service.js';

afterEach(() => {
    vi.useRealTimers();
});

function link(
    source: ScriptedSource<string>,
    next: SourceLink<string> | null = null,
    clock = new ManualClock(),
) {
    return new SourceLink(source, new SourceBudget(source.limit, clock), clock, next);
}

function recorder() {
    const events: string[] = [];
    const recipient: SourceRecipient<string> = {
        found: (source, value) => events.push(source + ':' + value),
        unavailable: ({ source, reason }: SourceUnavailability) =>
            events.push(source + ':' + reason),
    };

    return { events, recipient };
}

const found = (value: string): SourceReply<string> => ({ kind: 'found', value });

describe('SourceLink', () => {
    it('hands every answer over in order of preference', async () => {
        const chain = link(
            new ScriptedSource('bnf', found('a')),
            link(new ScriptedSource('ol', found('b'))),
        );
        const { events, recipient } = recorder();

        await chain.begin('9782253164692').handle(recipient);

        expect(events).toEqual(['bnf:a', 'ol:b']);
    });

    it('asks every source at once, before the first one answers', async () => {
        const first = new ScriptedSource<string>('bnf', 'hang');
        const second = new ScriptedSource('ol', found('b'));

        link(first, link(second)).begin('9782253164692');

        expect(second.asked).toEqual(['9782253164692']);
    });

    it('passes the lookup on when a source has nothing', async () => {
        const chain = link(
            new ScriptedSource<string>('bnf', { kind: 'none' }),
            link(new ScriptedSource('ol', found('b'))),
        );
        const { events, recipient } = recorder();

        await chain.begin('9782253164692').handle(recipient);

        expect(events).toEqual(['ol:b']);
    });

    it('reports a failing source and continues (example 20)', async () => {
        const chain = link(
            new ScriptedSource<string>('bnf', 'fail'),
            link(new ScriptedSource('ol', found('b'))),
        );
        const { events, recipient } = recorder();

        await chain.begin('9782253164692').handle(recipient);

        expect(events).toEqual(['bnf:failed', 'ol:b']);
    });

    it('reports a source that does not answer in time', async () => {
        vi.useFakeTimers();
        const chain = link(new ScriptedSource<string>('bnf', 'hang'));
        const { events, recipient } = recorder();

        const handled = chain.begin('9782253164692').handle(recipient);

        await vi.advanceTimersByTimeAsync(SourceLink.timeoutSeconds * 1000);
        await handled;

        expect(events).toEqual(['bnf:failed']);
    });

    it('does not ask a source over its rate limit (example 20)', async () => {
        const source = new ScriptedSource('bnf', found('a'), { requests: 1, seconds: 60 });
        const chain = link(source);
        const { events, recipient } = recorder();

        await chain.begin('9782253164692').handle(recorder().recipient);

        await chain.begin('9782723471930').handle(recipient);

        expect(source.asked).toEqual(['9782253164692']);
        expect(events).toEqual(['bnf:limited']);
    });

    it('waits as long as a source asked before asking it again (example 20)', async () => {
        const clock = new ManualClock();
        const source = new ScriptedSource<string>('bnf', {
            kind: 'limited',
            retryAt: new Date(clock.now().getTime() + 120_000),
        });
        const chain = link(source, null, clock);

        await chain.begin('9782253164692').handle(recorder().recipient);
        clock.advance(119);

        await chain.begin('9782723471930').handle(recorder().recipient);

        expect(source.asked).toEqual(['9782253164692']);
    });
});

describe('SourceLink.chain', () => {
    it('links the sources in the given order of preference', async () => {
        const chain = SourceLink.chain(
            [new ScriptedSource('bnf', found('a')), new ScriptedSource('ol', found('b'))],
            new ManualClock(),
        );
        const { events, recipient } = recorder();

        await chain!.begin('9782253164692').handle(recipient);

        expect(events).toEqual(['bnf:a', 'ol:b']);
    });

    it('gives each source its own budget', async () => {
        const chain = SourceLink.chain(
            [
                new ScriptedSource('bnf', found('a'), { requests: 1, seconds: 60 }),
                new ScriptedSource('ol', found('b'), { requests: 1, seconds: 60 }),
            ],
            new ManualClock(),
        );
        const { events, recipient } = recorder();

        await chain!.begin('9782253164692').handle(recipient);

        expect(events).toEqual(['bnf:a', 'ol:b']);
    });

    it('keeps the budgets across lookups', async () => {
        const source = new ScriptedSource('bnf', found('a'), { requests: 1, seconds: 60 });
        const chain = SourceLink.chain([source], new ManualClock());
        const { events, recipient } = recorder();

        await chain!.begin('9782253164692').handle(recorder().recipient);

        await chain!.begin('9782723471930').handle(recipient);

        expect(events).toEqual(['bnf:limited']);
    });

    it('is empty without sources', () => {
        const chain = SourceLink.chain<string>([], new ManualClock());

        expect(chain).toBeNull();
    });
});
