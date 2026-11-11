import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { InitialEntry } from 'react-router';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { AppearanceProvider } from '../shared/appearance/appearance-context';
import { SessionProvider } from '../shared/session/session-context';

export function renderRoute(path: InitialEntry, routes: Record<string, ReactNode>) {
    const router = createMemoryRouter(
        [
            ...Object.entries(routes).map(([pattern, element]) => ({ path: pattern, element })),
            { path: '*', element: <Elsewhere /> },
        ],
        { initialEntries: [path] },
    );

    render(
        <AppearanceProvider>
            <SessionProvider>
                <RouterProvider router={router} />
            </SessionProvider>
        </AppearanceProvider>,
    );

    return router;
}

function Elsewhere() {
    return <p>Elsewhere: {useLocation().pathname}</p>;
}
