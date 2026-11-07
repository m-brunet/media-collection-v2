import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { SavedPage } from './saved-page';

function open(followUpFailed = false) {
    return renderRoute(
        { pathname: '/saved', state: { title: 'Piranesi', followUpFailed } },
        { '/saved': <SavedPage /> },
    );
}

beforeEach(() => {
    deviceLanguages(['en-GB']);
    new FakeApi().signedIn(account());
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('confirms the saved book and offers Scan another book or Back to home', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Book added' })).toBeInTheDocument();
    expect(
        screen.getByText('“Piranesi” has been saved to your shared library.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
});

it('starts another scan', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Scan another book' }));

    expect(await screen.findByText('Elsewhere: /scan')).toBeInTheDocument();
});

it('says when the cover, reading status or note could not be saved', async () => {
    open(true);

    expect(
        await screen.findByText(
            'The book was saved, but its cover, your reading status or your note could not be saved. Edit the book to try again.',
        ),
    ).toBeInTheDocument();
});

it('shows no success without a confirmed save', async () => {
    renderRoute('/saved', { '/saved': <SavedPage /> });

    expect(await screen.findByText('Elsewhere: /')).toBeInTheDocument();
});
