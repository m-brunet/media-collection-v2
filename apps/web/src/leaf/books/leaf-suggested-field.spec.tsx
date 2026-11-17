import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../shared/i18n/i18n-context';
import { deviceLanguages } from '../../testing/fake-api.test-support';
import { LeafSuggestedField } from './leaf-suggested-field';
import type { Suggestion } from './suggestion-list.util';

const names: Suggestion[] = [
    { key: 'a1', label: 'Yukito Kishiro' },
    { key: 'a2', label: 'Yuki Kodama' },
];

function Field({
    suggestions,
    onChoose,
    onEnter,
}: {
    suggestions: Suggestion[];
    onChoose(suggestion: Suggestion): void;
    onEnter(): void;
}) {
    const [value, setValue] = useState('');

    return (
        <LeafSuggestedField
            label="Authors"
            value={value}
            suggestions={value ? suggestions : []}
            onChange={setValue}
            onChoose={onChoose}
            onEnter={onEnter}
        />
    );
}

function show(suggestions: Suggestion[] = names) {
    const onChoose = vi.fn();
    const onEnter = vi.fn();

    render(
        <I18nProvider>
            <Field suggestions={suggestions} onChoose={onChoose} onEnter={onEnter} />
            <button type="button">Elsewhere</button>
        </I18nProvider>,
    );

    return { onChoose, onEnter, field: screen.getByRole('combobox', { name: 'Authors' }) };
}

beforeEach(() => {
    deviceLanguages(['en-GB']);
});

it('lists the suggestions under the field while typing, named for screen readers', async () => {
    const { field } = show();

    await userEvent.type(field, 'yuk');

    const list = screen.getByRole('listbox', { name: 'Suggestions for Authors' });

    expect(
        within(list)
            .getAllByRole('option')
            .map((option) => option.textContent),
    ).toEqual(['Yukito Kishiro', 'Yuki Kodama']);
    expect(field).toHaveAttribute('aria-expanded', 'true');
    expect(field).toHaveAttribute('aria-controls', list.id);
});

it('shows no list when nothing matches', async () => {
    const { field } = show([]);

    await userEvent.type(field, 'yuk');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field).toHaveAttribute('aria-expanded', 'false');
});

it('chooses a tapped suggestion and closes the list', async () => {
    const { field, onChoose } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.click(screen.getByRole('option', { name: 'Yuki Kodama' }));

    expect(onChoose).toHaveBeenCalledWith({ key: 'a2', label: 'Yuki Kodama' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('moves in the list with the arrow keys', async () => {
    const { field } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');

    const second = screen.getByRole('option', { name: 'Yuki Kodama' });

    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(field).toHaveAttribute('aria-activedescendant', second.id);
});

it('goes back to the last suggestion with the up arrow from the first one', async () => {
    const { field } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.keyboard('{ArrowDown}{ArrowUp}');

    expect(screen.getByRole('option', { name: 'Yuki Kodama' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
});

it('chooses the suggestion reached with the arrows on Enter', async () => {
    const { field, onChoose, onEnter } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onChoose).toHaveBeenCalledWith({ key: 'a1', label: 'Yukito Kishiro' });
    expect(onEnter).not.toHaveBeenCalled();
});

it('leaves Enter to the field when no suggestion is reached', async () => {
    const { field, onChoose, onEnter } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.keyboard('{Enter}');

    expect(onEnter).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
});

it('closes the list on Escape and brings it back when typing goes on', async () => {
    const { field } = show();

    await userEvent.type(field, 'yuk');
    await userEvent.keyboard('{Escape}');
    const closed = screen.queryByRole('listbox');

    await userEvent.type(field, 'i');

    expect(closed).toBeNull();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
});

it('closes the list when the field loses focus', async () => {
    const { field } = show();

    await userEvent.type(field, 'yuk');

    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
