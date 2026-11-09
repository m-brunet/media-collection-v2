import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/i18n-context';
import { Brand } from './brand';
import { Button } from './button';
import { Dialog } from './dialog';
import { Notice } from './notice';
import { TextField } from './text-field';

it('associates a field with its label, hint and error', () => {
    render(<TextField label="Title" hint="As printed" error="Title is required" required />);

    const field = screen.getByLabelText(/Title/);

    expect(field).toBeRequired();
    expect(field).toHaveAccessibleDescription('As printed Title is required');
    expect(field).toHaveAttribute('aria-invalid', 'true');
});

it('prevents repeated submission while busy', () => {
    render(<Button busy>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
});

it('announces errors immediately and other feedback politely', () => {
    render(
        <>
            <Notice tone="error">Failed</Notice>
            <Notice tone="success">Saved</Notice>
        </>,
    );

    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent('Failed');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
});

it('shows an open dialog with its title', () => {
    render(
        <I18nProvider language="en">
            <Dialog open title="Delete shelf?" onClose={() => undefined}>
                Books are kept.
            </Dialog>
        </I18nProvider>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete shelf?' });

    expect(dialog).toHaveTextContent('Books are kept.');
});

it('closes a dialog from its close button', async () => {
    const close = vi.fn();

    render(
        <I18nProvider language="fr">
            <Dialog open title="Supprimer ?" onClose={close}>
                Contenu
            </Dialog>
        </I18nProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(close).toHaveBeenCalledOnce();
});

it('shows the fixed Libris and Leaf marks, drawn in the text colour', () => {
    const { container } = render(
        <I18nProvider language="en">
            <Brand app="libris" size="large" />
            <Brand app="leaf" />
        </I18nProvider>,
    );
    const [libris, leaf] = container.querySelectorAll('.brand__mark');

    expect([libris?.getAttribute('data-mark'), leaf?.getAttribute('data-mark')]).toEqual([
        'libris',
        'leaf',
    ]);
    expect((libris as HTMLElement).style.width).toBe('30px');
    expect(libris?.querySelector('[fill="currentColor"]')).not.toBeNull();
    expect(leaf?.querySelector('[stroke="currentColor"]')).not.toBeNull();
});
