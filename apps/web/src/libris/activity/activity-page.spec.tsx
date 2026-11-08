import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActivityEntryDto, ActivityPageDto } from '../../../../../packages/contracts/src/http';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import type { IconName } from '../../shared/ui/icon';
import { Icon } from '../../shared/ui/icon';
import { renderRoute } from '../../testing/render-route.test-support';
import { ActivityPage } from './activity-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function ago(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

function entry(id: string, overrides: Partial<ActivityEntryDto> = {}): ActivityEntryDto {
    return {
        id,
        occurredAt: ago(12.5),
        actor: 'alex',
        event: { kind: 'book-added', title: 'The Overstory' },
        also: [],
        ...overrides,
    };
}

function page(entries: ActivityEntryDto[], older: string | null = null): ActivityPageDto {
    return { entries, older };
}

function show() {
    return renderRoute('/activity', { '/activity': <ActivityPage /> });
}

// The class Lucide gives an icon, which names the drawing it shows.
function menuIcon(name: IconName): string | null | undefined {
    const { container, unmount } = render(<Icon name={name} />);
    const drawing = container.querySelector('svg')?.getAttribute('class');

    unmount();

    return drawing;
}

function iconOf(item: HTMLElement): string | undefined {
    return item
        .querySelector('.activity-entry__icon')
        ?.getAttribute('class')
        ?.replace(' activity-entry__icon', '');
}

function entries() {
    return within(screen.getByRole('list', { name: 'Shared activity, newest first' })).getAllByRole(
        'listitem',
    );
}

it('says what happened with the household You, whoever acted', async () => {
    new FakeApi()
        .signedIn(account({ username: 'morgan', role: 'guest' }))
        .on('GET /activity', () => ({
            status: 200,
            body: page([
                entry('o1', { actor: 'camille' }),
                entry('o2', {
                    occurredAt: ago(120),
                    event: { kind: 'books-lent', receiver: 'Sam Taylor', titles: ['A', 'B', 'C'] },
                }),
            ]),
        }));

    show();

    await screen.findByText('You added The Overstory');
    expect(
        entries().map((item) => item.querySelector('.activity-entry__action')?.textContent),
    ).toEqual(['You added The Overstory', 'You lent 3 books to Sam Taylor']);
});

it('tells a location change from a tag change, each with the icon of its menu', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([
            entry('o1', { event: { kind: 'book-relocated', title: 'Dune' } }),
            entry('o2', { event: { kind: 'book-retagged', title: 'Dune' } }),
        ]),
    }));

    show();

    await screen.findByText('You changed the location of Dune');
    const [relocated, retagged] = entries();

    expect(retagged).toHaveTextContent('You changed the tags of Dune');
    expect(iconOf(relocated!)).toBe(menuIcon('bookshelves'));
    expect(iconOf(retagged!)).toBe(menuIcon('tag'));
});

it('shows how long ago each change happened', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1'), entry('o2', { occurredAt: ago(0) })]),
    }));

    show();

    expect(await screen.findByText('12 minutes ago', { selector: 'time' })).toBeInTheDocument();
    expect(screen.getByText('Just now', { selector: 'time' })).toBeInTheDocument();
});

it('shows the changes an operation caused under it', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([
            entry('o1', {
                event: { kind: 'book-added', title: 'Naruto Vol. 1' },
                also: [{ kind: 'collection-created', name: 'Naruto' }],
            }),
        ]),
    }));

    show();

    expect(await screen.findByText('Also: created the collection Naruto')).toBeInTheDocument();
});

it('shows the exact time and the acting account on hover', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1', { occurredAt: '2026-11-01T12:42:00.000Z', actor: 'camille' })]),
    }));
    show();
    await screen.findByText('You added The Overstory');
    const time = document.querySelector('time')!;

    await userEvent.hover(time);

    const details = screen.getByRole('tooltip');

    expect(details).toBeVisible();
    expect(within(details).getByText(/^1 November 2026 · \d{2}:42 \(.+\)$/)).toBeVisible();
    expect(within(details).getByText('Performed by camille')).toBeVisible();
});

it('shows the exact details on keyboard focus', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1', { actor: 'camille' })]),
    }));
    show();
    await screen.findByText('12 minutes ago', { selector: 'time' });

    await userEvent.tab();

    expect(screen.getByText('12 minutes ago', { selector: 'time' })).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(screen.getByText('12 minutes ago', { selector: 'time' })).toHaveAccessibleDescription(
        /Performed by camille$/,
    );
});

it('hides the exact details with Escape', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1')]),
    }));
    show();
    await screen.findByText('12 minutes ago', { selector: 'time' });
    await userEvent.tab();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('hides the exact details when the pointer leaves', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1')]),
    }));
    show();
    const time = await screen.findByText('12 minutes ago', { selector: 'time' });

    fireEvent.mouseEnter(time.parentElement!);

    fireEvent.mouseLeave(time.parentElement!);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('loads older entries after the shown ones', async () => {
    const api = new FakeApi()
        .signedIn(account())
        .on('GET /activity', () => ({ status: 200, body: page([entry('o1')], 'cursor-1') }))
        .on('GET /activity?before=cursor-1', () => ({
            status: 200,
            body: page([entry('o2', { event: { kind: 'tag-created', name: 'Fantasy' } })]),
        }));

    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Load older activity' }));

    expect(await screen.findByText('You created the Fantasy tag')).toBeInTheDocument();
    expect(entries()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Load older activity' })).not.toBeInTheDocument();
    expect(api.calls.map((call) => call.route)).toContain('GET /activity?before=cursor-1');
});

it('offers no Load older when everything is shown', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1')]),
    }));

    show();

    await screen.findByText('You added The Overstory');
    expect(screen.queryByRole('button', { name: 'Load older activity' })).not.toBeInTheDocument();
});

it('keeps the shown entries when older ones cannot be loaded', async () => {
    new FakeApi()
        .signedIn(account())
        .on('GET /activity', () => ({ status: 200, body: page([entry('o1')], 'cursor-1') }))
        .on('GET /activity?before=cursor-1', () => ({ status: 500, body: { message: 'Down' } }));
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Load older activity' }));

    expect(await screen.findByText('Older activity could not be loaded.')).toBeInTheDocument();
    expect(entries()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Load older activity' })).toBeEnabled();
});

it('explains that nothing happened yet', async () => {
    new FakeApi().signedIn(account()).on('GET /activity', () => ({
        status: 200,
        body: page([]),
    }));

    show();

    expect(await screen.findByText('No shared activity yet.')).toBeInTheDocument();
    expect(
        screen.getByText('Successful changes to the library will appear here.'),
    ).toBeInTheDocument();
});

it('shows a failure and loads again on Try again', async () => {
    let attempts = 0;

    new FakeApi().signedIn(account()).on('GET /activity', () => {
        attempts++;

        return attempts === 1
            ? { status: 500, body: { message: 'Down' } }
            : { status: 200, body: page([entry('o1')]) };
    });
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('You added The Overstory')).toBeInTheDocument();
});

it('speaks French', async () => {
    deviceLanguages(['fr-FR']);
    new FakeApi().signedIn(account({ language: 'fr' })).on('GET /activity', () => ({
        status: 200,
        body: page([entry('o1')]),
    }));

    show();

    expect(await screen.findByText('Vous avez ajouté The Overstory')).toBeInTheDocument();
    expect(screen.getByText('Il y a 12 minutes', { selector: 'time' })).toBeInTheDocument();
});
