import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MenuButton } from './menu-button';

function shelfMenu(rename = vi.fn()) {
    render(
        <>
            <MenuButton
                label="Shelf 3 actions"
                actions={[
                    { label: 'Rename', icon: 'edit', onSelect: rename },
                    { label: 'Move shelf', icon: 'move', onSelect: vi.fn() },
                    { label: 'Delete', icon: 'delete', danger: true, onSelect: vi.fn() },
                ]}
            />
            <p>Outside</p>
        </>,
    );

    return rename;
}

it('keeps the menu closed until its button is pressed', () => {
    shelfMenu();

    const button = screen.getByRole('button', { name: 'Shelf 3 actions' });

    expect([button.getAttribute('aria-expanded'), screen.queryByRole('menu')]).toEqual([
        'false',
        null,
    ]);
});

it('opens the menu with the focus on its first action', async () => {
    shelfMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
});

it('moves between the actions with the arrow keys, round the end', async () => {
    shelfMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    await userEvent.keyboard('{ArrowUp}');

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
});

it('runs the chosen action and closes the menu', async () => {
    const rename = shelfMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect([rename.mock.calls.length, screen.queryByRole('menu')]).toEqual([1, null]);
});

it('closes with Escape and gives the focus back to its button', async () => {
    shelfMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Shelf 3 actions' })).toHaveFocus();
});

it('closes when the pointer presses outside', async () => {
    shelfMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Shelf 3 actions' }));

    await userEvent.click(screen.getByText('Outside'));

    expect(screen.queryByRole('menu')).toBeNull();
});
