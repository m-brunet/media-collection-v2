import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Appearance, ColorSchemeName } from '../../../../../packages/contracts/src/http';
import { api } from '../api.util';
import { ColorSchemeDocument } from './color-scheme-document.util';

interface AppearanceValue {
    colorScheme: ColorSchemeName;
    // Administrator only: saves the scheme for the whole installation and applies it here.
    saveColorScheme(name: ColorSchemeName): Promise<void>;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

// Loads the installation-wide appearance (public, also before sign-in) and applies it.
export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [colorScheme, setColorScheme] = useState<ColorSchemeName>(
        () =>
            (document.documentElement.dataset.colorScheme as ColorSchemeName | undefined) ??
            'spring-green',
    );

    useEffect(() => {
        void api
            .request<Appearance>('/appearance', { passive: true })
            .then((appearance) => {
                ColorSchemeDocument.apply(appearance.colorScheme);
                setColorScheme(appearance.colorScheme);
            })
            .catch(() => undefined);
    }, []);

    const saveColorScheme = useCallback(async (name: ColorSchemeName) => {
        const appearance = await api.request<Appearance>('/appearance', {
            method: 'PUT',
            body: { colorScheme: name },
        });

        ColorSchemeDocument.apply(appearance.colorScheme);
        setColorScheme(appearance.colorScheme);
    }, []);
    const value = useMemo(() => ({ colorScheme, saveColorScheme }), [colorScheme, saveColorScheme]);

    return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
    const value = useContext(AppearanceContext);

    if (!value) {
        throw new Error('useAppearance must be used inside AppearanceProvider.');
    }

    return value;
}
