import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { I18nProvider } from '../i18n/i18n-context';
import { ShelfSelect } from './shelf-select';

function show(field: ReactElement) {
    render(<I18nProvider language="en">{field}</I18nProvider>);
}

const bookcases: BookcaseDto[] = [
    {
        id: 'oak',
        name: 'Oak',
        bookCount: 0,
        shelves: [
            { id: 'oak-top', bookcaseId: 'oak', name: 'Top', bookCount: 0 },
            { id: 'oak-low', bookcaseId: 'oak', name: 'Bottom', bookCount: 0 },
        ],
    },
    {
        id: 'study',
        name: 'Study',
        bookCount: 0,
        shelves: [{ id: 'study-top', bookcaseId: 'study', name: 'Top', bookCount: 0 }],
    },
    { id: 'hall', name: 'Hall', bookCount: 0, shelves: [] },
];

function select() {
    return screen.getByRole('combobox', { name: 'Physical location' });
}

it('groups the shelves under their bookcase, leaving out a bookcase without shelves', () => {
    show(<ShelfSelect bookcases={bookcases} shelfId={null} onChange={vi.fn()} />);

    const groups = within(select()).getAllByRole('group');

    expect(groups.map((group) => group.getAttribute('label'))).toEqual(['Oak', 'Study']);
});

it('names each shelf with its bookcase, so shelves of the same name stay apart', () => {
    show(<ShelfSelect bookcases={bookcases} shelfId={null} onChange={vi.fn()} />);

    const names = within(select())
        .getAllByRole('option')
        .map((option) => option.textContent);

    expect(names).toEqual(['Unassigned', 'Oak – Top', 'Oak – Bottom', 'Study – Top']);
});

it('shows the current shelf', () => {
    show(<ShelfSelect bookcases={bookcases} shelfId="study-top" onChange={vi.fn()} />);

    expect(select()).toHaveValue('study-top');
});

it('gives the chosen shelf with its bookcase', async () => {
    const onChange = vi.fn();

    show(<ShelfSelect bookcases={bookcases} shelfId={null} onChange={onChange} />);

    await userEvent.selectOptions(select(), 'Study – Top');

    expect(onChange).toHaveBeenCalledWith({ bookcaseId: 'study', shelfId: 'study-top' });
});

it('clears both the bookcase and the shelf with Unassigned', async () => {
    const onChange = vi.fn();

    show(<ShelfSelect bookcases={bookcases} shelfId="oak-top" onChange={onChange} />);

    await userEvent.selectOptions(select(), 'Unassigned');

    expect(onChange).toHaveBeenCalledWith({ bookcaseId: null, shelfId: null });
});

it('asks for a real shelf when one is required', () => {
    show(<ShelfSelect bookcases={bookcases} shelfId={null} required onChange={vi.fn()} />);

    const first = within(select()).getAllByRole('option')[0];

    expect([first?.textContent, first?.hasAttribute('disabled'), select()]).toEqual([
        'Choose a shelf',
        true,
        expect.objectContaining({ required: true }),
    ]);
});

it('ties its hint and its error to the field', () => {
    show(
        <ShelfSelect
            bookcases={bookcases}
            shelfId={null}
            hint="Choose an existing shelf or leave unassigned."
            error="Choose a shelf."
            onChange={vi.fn()}
        />,
    );

    expect(select()).toHaveAccessibleDescription(
        'Choose an existing shelf or leave unassigned. Choose a shelf.',
    );
});
