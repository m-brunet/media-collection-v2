import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { AppearanceProvider } from '../shared/appearance/appearance-context';
import { SessionProvider } from '../shared/session/session-context';

// Renders pages inside a data router (as Libris does) with the session, starting at `path`.
// `routes` maps route patterns to their page; every other path shows "Elsewhere: <path>".
export function renderRoute(path: string, routes: Record<string, ReactNode>) {
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
