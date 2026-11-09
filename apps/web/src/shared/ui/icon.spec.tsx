import { render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Icon } from './icon';

it('draws Lucide by default', () => {
    const { container } = render(<Icon name="overview" />);

    expect(container.querySelector('svg.lucide')).not.toBeNull();
});
it('draws the artwork of the chosen icon set', async () => {
    const { container } = render(<Icon name="overview" set="hand-inked-editorial" size={24} />);

    await waitFor(() => expect(container.querySelector('[data-icon-set]')).not.toBeNull());

    const art = container.querySelector<HTMLElement>('[data-icon-set]')!;

    expect([art.dataset.iconSet, art.style.width, art.querySelector('svg')]).toEqual([
        'hand-inked-editorial',
        '24px',
        expect.anything(),
    ]);
});
it('keeps Lucide for utility icons in every set', async () => {
    const { container } = render(
        <>
            <Icon name="overview" set="solid-silhouettes" />
            <Icon name="close" set="solid-silhouettes" />
        </>,
    );

    await waitFor(() => expect(container.querySelector('[data-icon-set]')).not.toBeNull());

    const drawn = [
        container.querySelectorAll('[data-icon-set]').length,
        container.querySelectorAll('svg.lucide').length,
    ];

    expect(drawn).toEqual([1, 1]);
});
it('names a meaningful icon of a set for assistive technology', async () => {
    render(<Icon name="scan" set="quiet-editorial-monoline" label="Scan a barcode" />);

    await waitFor(() =>
        expect(screen.getByRole('img', { name: 'Scan a barcode' }).dataset.iconSet).toBe(
            'quiet-editorial-monoline',
        ),
    );

    const icon = screen.getByRole('img', { name: 'Scan a barcode' });

    expect(icon.getAttribute('aria-hidden')).toBeNull();
});
it('draws the set artwork in the colour scheme colours', async () => {
    const { container } = render(<Icon name="overview" set="solid-silhouettes" />);

    await waitFor(() => expect(container.querySelector('[data-icon-set]')).not.toBeNull());

    const markup = container.querySelector('[data-icon-set]')!.innerHTML;

    expect([/#[0-9a-f]{6}/i.test(markup), markup.includes('var(--color-')]).toEqual([false, true]);
});
