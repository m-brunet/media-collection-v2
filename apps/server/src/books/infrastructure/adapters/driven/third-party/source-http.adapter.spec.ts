import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import type { Fetcher } from './source-http.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

const now = new Date('2026-11-06T10:00:00Z');

function answering(status: number, headers: Record<string, string> = {}) {
    const sent: { url: string; headers: Record<string, string> }[] = [];
    const fetcher: Fetcher = async (url, init) => {
        sent.push({ url, headers: init.headers });

        return new Response('body', { status, headers });
    };

    return { sent, http: new SourceHttp(SourceProbe.queue(), fetcher, () => now) };
}

describe('SourceHttp', () => {
    it('identifies the application, never a person', async () => {
        const { sent, http } = answering(200);

        await http.get('https://source.example/books', 'application/json', SourceProbe.turn);

        expect(sent[0]!.headers).toEqual({
            'User-Agent': SourceHttp.userAgent,
            Accept: 'application/json',
        });
    });

    it('gives a successful answer back', async () => {
        const { http } = answering(200);

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply.kind === 'ok' && (await reply.response.text())).toBe('body');
    });

    it('turns "too many requests" with a delay into the time to wait', async () => {
        const { http } = answering(429, { 'Retry-After': '120' });

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply).toEqual({ kind: 'limited', retryAt: new Date('2026-11-06T10:02:00Z') });
    });

    it('turns "unavailable" with a date into that time', async () => {
        const { http } = answering(503, { 'Retry-After': 'Fri, 06 Nov 2026 11:00:00 GMT' });

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply).toEqual({ kind: 'limited', retryAt: new Date('2026-11-06T11:00:00Z') });
    });

    it('waits without a time when the source gives none', async () => {
        const { http } = answering(429);

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply).toEqual({ kind: 'limited', retryAt: null });
    });

    it('sends nothing more to a service that asked to wait', async () => {
        const { sent, http } = answering(429, { 'Retry-After': '120' });

        await http.get('https://source.example/books', 'application/json', SourceProbe.turn);

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply.kind).toBe('limited');
        expect(sent).toHaveLength(1);
    });

    it('hands back the refusal of a queue that is too long, without a request', async () => {
        const sent: string[] = [];
        const queue = SourceProbe.queue();

        queue.send = async () => ({ kind: 'busy' });
        const http = new SourceHttp(queue, async (url) => {
            sent.push(url);

            return new Response('body');
        });

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        expect(reply).toEqual({ kind: 'busy' });
        expect(sent).toEqual([]);
    });

    it('does not send a failed request again', async () => {
        const { sent, http } = answering(500);

        await http
            .get('https://source.example/books', 'application/json', SourceProbe.turn)
            .catch(() => undefined);

        expect(sent).toHaveLength(1);
    });

    it('gives back an error answer its caller expects', async () => {
        const { http } = answering(404);

        const reply = await http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
            [404],
        );

        expect(reply.kind === 'ok' && reply.response.status).toBe(404);
    });

    it('fails on any other error answer', async () => {
        const { http } = answering(500);

        const reply = http.get(
            'https://source.example/books',
            'application/json',
            SourceProbe.turn,
        );

        await expect(reply).rejects.toThrow('answered 500');
    });
});
