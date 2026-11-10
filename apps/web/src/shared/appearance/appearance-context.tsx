import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
    Appearance,
    ColorSchemeName,
    IconSetName,
} from '../../../../../packages/contracts/src/http';
import { api } from '../api.util';
import { ColorSchemeDocument } from './color-scheme-document.util';
import { IconSetMemory } from './icon-set-memory.util';

interface AppearanceValue {
    colorScheme: ColorSchemeName;
    iconSet: IconSetName;
    saveColorScheme(name: ColorSchemeName): Promise<void>;
    saveIconSet(name: IconSetName): Promise<void>;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
    const [colorScheme, setColorScheme] = useState<ColorSchemeName>(
        () =>
            (document.documentElement.dataset.colorScheme as ColorSchemeName | undefined) ??
            'spring-green',
    );
    const [iconSet, setIconSet] = useState<IconSetName>(() => IconSetMemory.read());

    useEffect(() => {
        void api
            .request<Appearance>('/appearance', { passive: true })
            .then((appearance) => {
                ColorSchemeDocument.apply(appearance.colorScheme);
                setColorScheme(appearance.colorScheme);
                IconSetMemory.write(appearance.iconSet);
                setIconSet(appearance.iconSet);
            })
            .catch(() => undefined);
    }, []);

    const saveColorScheme = useCallback(async (name: ColorSchemeName) => {
        const appearance = await api.request<Pick<Appearance, 'colorScheme'>>('/appearance', {
            method: 'PUT',
            body: { colorScheme: name },
        });

        ColorSchemeDocument.apply(appearance.colorScheme);
        setColorScheme(appearance.colorScheme);
    }, []);
    const saveIconSet = useCallback(async (name: IconSetName) => {
        const saved = await api.request<Pick<Appearance, 'iconSet'>>('/appearance/icon-set', {
            method: 'PUT',
            body: { iconSet: name },
        });

        IconSetMemory.write(saved.iconSet);
        setIconSet(saved.iconSet);
    }, []);
    const value = useMemo(
        () => ({ colorScheme, iconSet, saveColorScheme, saveIconSet }),
        [colorScheme, iconSet, saveColorScheme, saveIconSet],
    );

    return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
    const value = useContext(AppearanceContext);

    if (!value) {
        throw new Error('useAppearance must be used inside AppearanceProvider.');
    }

    return value;
}

export function useIconSet(): IconSetName {
    return useContext(AppearanceContext)?.iconSet ?? 'lucide';
}
