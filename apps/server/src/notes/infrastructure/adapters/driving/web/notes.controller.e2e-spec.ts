import type { NoteDto } from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';
import { NoteFixture } from '../../../../../../../../tests/api/fixtures/note.fixture.js';

let app: TestApp;
const admin = new UserFixture({ username: 'administrator', role: 'admin' });
const member = new UserFixture({ username: 'member' });
const restricted = new UserFixture({
    username: 'restricted',
    role: 'admin',
    mustChangePassword: true,
});

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([admin, member, restricted]);
});
afterEach(async () => {
    await app?.teardown();
});
let own: NoteFixture;
let foreign: NoteFixture;

beforeEach(async () => {
    own = new NoteFixture(member.id);
    foreign = new NoteFixture(admin.id);
    await app.loadFixtures([own, foreign]);
});
describe('GET /api/notes', () => {
    it('lists only the current owners notes', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call<NoteDto[]>('/notes', 'GET');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]!.id).toBe(own.getId());
        expect(response.body[0]).not.toHaveProperty('ownerId');
    });
    it('does not grant administrators access to another owners list', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<NoteDto[]>('/notes', 'GET');

        expect(response.status).toBe(200);
        expect(response.body.map((note) => note.id)).toEqual([foreign.getId()]);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call<NoteDto[]>('/notes', 'GET');

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call<NoteDto[]>('/notes', 'GET');

        expect(response.status).toBe(403);
    });
});
describe('GET /api/notes/:id', () => {
    it('operates on the authenticated owners note', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/' + own.getId(), 'GET');

        expect(response.status).toBe(200);
        expect(response.body.body).toBe('Fixture content');
    });
    it("rejects a user reading another owner's note", async () => {
        const client = await app.authenticatedClient(member);
        const target = foreign;

        const response = await client.call('/notes/' + target.getId(), 'GET');

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it("rejects an administrator reading another owner's note", async () => {
        const client = await app.authenticatedClient(admin);
        const target = own;

        const response = await client.call('/notes/' + target.getId(), 'GET');

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it('rejects a malformed id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/not-a-uuid', 'GET');

        expect(response.status).toBe(400);
    });
    it('reports an absent id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'GET');

        expect(response.status).toBe(404);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'GET');

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'GET');

        expect(response.status).toBe(403);
    });
});
describe('PATCH /api/notes/:id', () => {
    it('operates on the authenticated owners note', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/' + own.getId(), 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(200);
        expect(response.body.title).toBe('Updated');
        expect((await app.dependencies.notes.find(member.id, own.getId()))!.snapshot.body).toBe(
            'Changed',
        );
    });
    it("rejects a user updating another owner's note", async () => {
        const client = await app.authenticatedClient(member);
        const target = foreign;

        const response = await client.call('/notes/' + target.getId(), 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it("rejects an administrator updating another owner's note", async () => {
        const client = await app.authenticatedClient(admin);
        const target = own;

        const response = await client.call('/notes/' + target.getId(), 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it('rejects a malformed id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/not-a-uuid', 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(400);
    });
    it('reports an absent id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(404);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call('/notes/00000000-0000-4000-8000-000000000000', 'PATCH', {
            title: 'Updated',
            body: 'Changed',
        });

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/notes/00000000-0000-4000-8000-000000000000',
            'PATCH',
            { title: 'Updated', body: 'Changed' },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects invalid input without changing the note', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/' + own.getId(), 'PATCH', {
            title: ' ',
            body: '',
        });

        expect(response.status).toBe(400);
        expect((await app.dependencies.notes.find(member.id, own.getId()))!.snapshot.title).toBe(
            'Private note',
        );
    });
});
describe('DELETE /api/notes/:id', () => {
    it('operates on the authenticated owners note', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/' + own.getId(), 'DELETE', {});

        expect(response.status).toBe(204);
        expect(await app.dependencies.notes.find(member.id, own.getId()))!.toBeNull();
        expect(response.text).toBe('');
    });
    it("rejects a user deleting another owner's note", async () => {
        const client = await app.authenticatedClient(member);
        const target = foreign;

        const response = await client.call('/notes/' + target.getId(), 'DELETE', {});

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it("rejects an administrator deleting another owner's note", async () => {
        const client = await app.authenticatedClient(admin);
        const target = own;

        const response = await client.call('/notes/' + target.getId(), 'DELETE', {});

        expect(response.status).toBe(404);
        expect(
            await app.dependencies.notes.find(target.entity.snapshot.ownerId, target.getId()),
        )!.not.toBeNull();
    });
    it('rejects a malformed id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes/not-a-uuid', 'DELETE', {});

        expect(response.status).toBe(400);
    });
    it('reports an absent id', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call(
            '/notes/00000000-0000-4000-8000-000000000000',
            'DELETE',
            {},
        );

        expect(response.status).toBe(404);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call(
            '/notes/00000000-0000-4000-8000-000000000000',
            'DELETE',
            {},
        );

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call(
            '/notes/00000000-0000-4000-8000-000000000000',
            'DELETE',
            {},
        );

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call(
            '/notes/00000000-0000-4000-8000-000000000000',
            'DELETE',
            {},
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
});
describe('POST /api/notes', () => {
    it('creates a normalized note owned by the authenticated user', async () => {
        const client = await app.authenticatedClient(member);

        const response = await client.call<NoteDto>('/notes', 'POST', {
            title: ' Title ',
            body: 'Created',
        });

        expect(response.status).toBe(201);
        expect(response.body.title).toBe('Title');
        expect(response.body).not.toHaveProperty('ownerId');
        expect(
            (await app.dependencies.notes.find(member.id, response.body.id))!.snapshot.ownerId,
        ).toBe(member.id);
    });
    it('rejects unauthenticated access', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call<NoteDto>('/notes', 'POST', { title: 'Valid', body: '' });

        expect(response.status).toBe(401);
    });
    it('rejects incomplete password setup', async () => {
        const client = await app.authenticatedClient(restricted);

        const response = await client.call<NoteDto>('/notes', 'POST', { title: 'Valid', body: '' });

        expect(response.status).toBe(403);
    });
    it('rejects missing CSRF protection', async () => {
        const client = await app.authenticatedClient(admin);

        const response = await client.call<NoteDto>(
            '/notes',
            'POST',
            { title: 'Valid', body: '' },
            { csrf: false },
        );

        expect(response.status).toBe(403);
    });
    it('rejects creation with an empty title', async () => {
        const input = { title: '', body: '' };
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes', 'POST', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.notes.list(member.id)).toHaveLength(1);
    });
    it('rejects creation with a forged owner', async () => {
        const input = { title: 'Valid', body: '', ownerId: 'other' };
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes', 'POST', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.notes.list(member.id)).toHaveLength(1);
    });
    it('rejects creation with an overlong title', async () => {
        const input = { title: 'x'.repeat(121), body: '' };
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes', 'POST', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.notes.list(member.id)).toHaveLength(1);
    });
    it('rejects creation with an overlong body', async () => {
        const input = { title: 'Valid', body: 'x'.repeat(100001) };
        const client = await app.authenticatedClient(member);

        const response = await client.call('/notes', 'POST', input);

        expect(response.status).toBe(400);
        expect(await app.dependencies.notes.list(member.id)).toHaveLength(1);
    });
});
