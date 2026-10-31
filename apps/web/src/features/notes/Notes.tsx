import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { NoteDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useAction } from '../../shared/use-action';

export function Notes() {
    const [ notes, setNotes ] = useState<NoteDto[]>([]);
    const [ selected, setSelected ] = useState<NoteDto | null>(null);
    const action = useAction();
    const { setMessage } = action;

    useEffect(() => {
        void api.request<NoteDto[]>('/notes')
            .then(setNotes)
            .catch((error) => setMessage(String(error.message)));
    }, [ setMessage ]);
    const open = (id: string) => {
        void action.run(async () => setSelected(await api.request<NoteDto>('/notes/' + id)));
    };
    const save = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        void action.run(async () => {
            const note = await api.request<NoteDto>(selected ? '/notes/' + selected.id : '/notes', {
                method: selected ? 'PATCH' : 'POST',
                body: { title: form.get('title'), body: form.get('body') }
            });

            setNotes((previous) => [ note, ...previous.filter((item) => item.id !== note.id) ]);
            setSelected(note);
        }, 'Note saved.');
    };
    const remove = () => {
        if (selected && window.confirm('Delete this note?')) {
            void action.run(async () => {
                await api.request('/notes/' + selected.id, { method: 'DELETE' });
                setNotes((previous) => previous.filter((item) => item.id !== selected.id));
                setSelected(null);
            }, 'Note deleted.');
        }
    };

    return (
        <section className="card">
            <div className="section-heading">
                <h1>Your notes</h1>
                <button
                    type="button"
                    className="secondary"
                    onClick={ () => {
                        setSelected(null);
                        action.setMessage('');
                    } }
                >
                    New note
                </button>
            </div>
            <div className="notes-layout">
                <aside aria-label="Your saved notes">
                    { notes.length === 0 && <p className="muted">No notes yet.</p> }
                    { notes.map((note) => (
                        <button
                            className={ 'note-link' + (selected?.id === note.id ? ' selected' : '') }
                            type="button"
                            key={ note.id }
                            onClick={ () => open(note.id) }
                        >
                            { note.title }
                        </button>
                    )) }
                </aside>
                <form onSubmit={ save } key={ selected?.id ?? 'new' }>
                    <label>
                        Title
                        <input
                            name="title"
                            defaultValue={ selected?.title ?? '' }
                            required
                            maxLength={ 120 }
                        />
                    </label>
                    <label>
                        Plain text
                        <textarea
                            name="body"
                            defaultValue={ selected?.body ?? '' }
                            maxLength={ 100000 }
                            rows={ 12 }
                        />
                    </label>
                    <div className="actions">
                        <button disabled={ action.busy }>Save note</button>
                        { selected && (
                            <button
                                className="danger"
                                type="button"
                                disabled={ action.busy }
                                onClick={ remove }
                            >
                                Delete
                            </button>
                        ) }
                    </div>
                    { selected && (
                        <p className="muted">
                            Updated { new Date(selected.updatedAt).toLocaleString() }
                        </p>
                    ) }
                </form>
            </div>
            <p role="status">{ action.message }</p>
        </section>
    );
}
