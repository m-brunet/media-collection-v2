import type { FormEvent } from 'react';
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useAction } from '../../shared/use-action';

export function Login({ onLogin }: { onLogin(account: Account): void }) {
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        void action.run(async () =>
            onLogin(
                await api.request<Account>('/auth/login', {
                    method: 'POST',
                    body: { username: form.get('username'), password: form.get('password') }
                }),
            ),
        );
    };

    return (
        <section className="card narrow">
            <h1>Sign in</h1>
            <p>Access your private notes and account.</p>
            <form onSubmit={ submit }>
                <label>
                    Username
                    <input name="username" autoComplete="username" required maxLength={ 40 }/>
                </label>
                <label>
                    Password
                    <input
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={ 128 }
                    />
                </label>
                <button disabled={ action.busy }>Sign in</button>
            </form>
            <p role="status">{ action.message }</p>
            <p className="muted">
                First startup: admin / p@ssw0rd. You will be asked to replace the password.
            </p>
        </section>
    );
}

export function Credentials({
    account,
    onChange
}: {
    account: Account;
    onChange(account: Account): void;
}) {
    const action = useAction();
    const password = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        if (form.get('password') !== form.get('confirmation')) {
            action.setMessage('The new passwords must match.');

            return;
        }

        void action.run(async () => {
            onChange(
                await api.request<Account>('/account/password', {
                    method: 'PATCH',
                    body: {
                        currentPassword: form.get('currentPassword'),
                        password: form.get('password')
                    },
                }),
            );
            element.reset();
        }, 'Password changed.');
    };
    const username = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        void action.run(async () => {
            onChange(
                await api.request<Account>('/account/username', {
                    method: 'PATCH',
                    body: {
                        username: form.get('username'),
                        currentPassword: form.get('currentPassword')
                    },
                }),
            );
            element.reset();
        }, 'Username changed.');
    };

    return (
        <section className="card">
            <h1>
                { account.mustChangePassword ? 'Replace your temporary password' : 'Your account' }
            </h1>
            { account.mustChangePassword && (
                <p>Choose a new password to finish setup. Changing your username is optional.</p>
            ) }
            <div className="columns">
                <form onSubmit={ password }>
                    <h2>Change password</h2>
                    <label>
                        Current password
                        <input
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            maxLength={ 128 }
                        />
                    </label>
                    <label>
                        New password
                        <input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={ 8 }
                            maxLength={ 128 }
                            required
                        />
                    </label>
                    <label>
                        Repeat new password
                        <input
                            name="confirmation"
                            type="password"
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    <button disabled={ action.busy }>Save password</button>
                </form>
                <form onSubmit={ username }>
                    <h2>Change username</h2>
                    <label>
                        New username
                        <input
                            name="username"
                            defaultValue={ account.username }
                            autoComplete="username"
                            required
                            minLength={ 3 }
                            maxLength={ 40 }
                            pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}"
                        />
                    </label>
                    <label>
                        Current password
                        <input
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            maxLength={ 128 }
                        />
                    </label>
                    <button disabled={ action.busy }>Save username</button>
                </form>
            </div>
            <p role="status">{ action.message }</p>
        </section>
    );
}
