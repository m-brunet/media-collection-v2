import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import type { Choice } from './choice-buttons';
import { ChoiceButtons } from './choice-buttons';

type Category = 'books' | 'manga' | 'comics';

const choices: Choice<Category>[] = [
    { value: 'books', label: 'Books' },
    { value: 'manga', label: 'Manga' },
    { value: 'comics', label: 'Comics' },
];

function Category() {
    const [value, setValue] = useState<Category>('books');

    return (
        <ChoiceButtons
            label="Category"
            value={value}
            choices={choices}
            onChange={(next) => setValue(next)}
        />
    );
}

it('names the group of choices after its field', () => {
    render(<Category />);

    const group = screen.getByRole('group', { name: 'Category' });

    expect(group).toBeInTheDocument();
});

it('selects the pressed choice and deselects the others', async () => {
    render(<Category />);

    await userEvent.click(screen.getByText('Comics'));

    expect(screen.getByRole('radio', { name: 'Comics' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Books' })).not.toBeChecked();
});

it('gives the selected choice the pressed look', async () => {
    render(<Category />);

    await userEvent.click(screen.getByText('Manga'));

    expect(screen.getByText('Manga').closest('label')).toHaveClass('button--pressed');
    expect(screen.getByText('Books').closest('label')).not.toHaveClass('button--pressed');
});

it('moves the selection with the arrow keys', async () => {
    render(<Category />);
    screen.getByRole('radio', { name: 'Books' }).focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Manga' })).toBeChecked();
});
