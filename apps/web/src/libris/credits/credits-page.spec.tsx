import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Credits } from '../../shared/credits/credits.util';
import { deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { CreditsPage } from './credits-page';

beforeEach(() => {
    deviceLanguages(['en-GB']);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

async function renderPage() {
    new FakeApi();
    renderRoute('/credits', { '/credits': <CreditsPage /> });
    await screen.findByRole('heading', { name: 'Credits and licences', level: 1 });
}

it('lists every credit with a link to its source', async () => {
    const names = Credits.groups.flatMap((group) => group.credits.map((credit) => credit.name));

    await renderPage();

    expect(names.filter((name) => !screen.queryByRole('link', { name }))).toEqual([]);
});
it('credits the CC BY icon packs with their licence and changes', async () => {
    await renderPage();

    const pack = screen.getByRole('link', { name: 'Streamline Freehand' }).closest('li')!;

    expect(within(pack).getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
        'href',
        'https://creativecommons.org/licenses/by/4.0/',
    );
    expect(within(pack).getByText(/redrawn in the text colour/)).toBeInTheDocument();
});
it('states that the Turning leaf icons are original, generated in the style of the sets', async () => {
    await renderPage();

    const leaf = screen.getByRole('link', { name: 'Turning leaf' }).closest('li')!;

    expect(within(leaf).getByText(/drawn in the style of each icon set/)).toBeInTheDocument();
    expect(within(leaf).getByText('Original artwork')).toBeInTheDocument();
});
it('credits the BnF as the source of book information', async () => {
    await renderPage();

    const source = screen.getByText(/Source: Bibliothèque nationale de France/);

    expect(source).toBeInTheDocument();
});
