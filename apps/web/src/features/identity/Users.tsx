import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useAction } from '../../shared/use-action';

export function Users() {
    const [ users, setUsers ] = useState<Account[]>([]);
    const action = useAction();
    const { setMessage } = action;

    useEffect(() => {
        void api.request<Account[]>('/users')
            .then(setUsers)
            .catch((error) => setMessage(String(error.message)));
    }, [ setMessage ]);
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        void action.run(async () => {
            const user = await api.request<Account>('/users', {
                method: 'POST',
                body: {
                    username: form.get('username'),
                    password: form.get('password'),
                    role: form.get('role')
                },
            });

            setUsers((previous) => [ ...previous, user ]);
            element.reset();
        }, 'Account created. Share the temporary password with its owner.');
    };

    return (
        <section className="card">
            <h1>Accounts</h1>
            <table>
                <thead>
                <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Setup</th>
                </tr>
                </thead>
                <tbody>
                { users.map((user) => (
                    <tr key={ user.id }>
                        <td>{ user.username }</td>
                        <td>{ user.role }</td>
                        <td>
                            { user.mustChangePassword
                                ? 'Password replacement required'
                                : 'Complete' }
                        </td>
                    </tr>
                )) }
                </tbody>
            </table>
            <form onSubmit={ submit } className="narrow">
                <h2>Create account</h2>
                <label>
                    Username
                    <input
                        name="username"
                        required
                        minLength={ 3 }
                        maxLength={ 40 }
                        autoComplete="off"
                    />
                </label>
                <label>
                    Temporary password
                    <input
                        name="password"
                        type="password"
                        required
                        minLength={ 8 }
                        maxLength={ 128 }
                        autoComplete="new-password"
                    />
                </label>
                <label>
                    Role
                    <select name="role">
                        <option value="user">User</option>
                        <option value="admin">Administrator</option>
                    </select>
                </label>
                <button disabled={ action.busy }>Create account</button>
            </form>
            <p role="status">{ action.message }</p>
        </section>
    );
}
