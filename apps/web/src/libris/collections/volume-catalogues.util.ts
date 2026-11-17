import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';

type Translate = (key: MessageKey, values?: MessageValues) => string;

export class VolumeCatalogues {
    private static readonly names: Record<string, MessageKey> = {
        bnf: 'volumes.catalogue.bnf',
        sudoc: 'volumes.catalogue.sudoc',
    };

    private static readonly suggestions: Record<string, MessageKey> = {
        bnf: 'volumes.suggests.bnf',
        sudoc: 'volumes.suggests.sudoc',
    };

    static found(catalogues: readonly string[], volume: number, t: Translate): string {
        return VolumeCatalogues.sentence('volumes.reviewHint', catalogues, t, { volume });
    }

    static unavailable(catalogues: readonly string[], t: Translate): string {
        return VolumeCatalogues.sentence('volumes.unavailable', catalogues, t);
    }

    static incomplete(catalogues: readonly string[], t: Translate): string | null {
        return catalogues.length === 0
            ? null
            : VolumeCatalogues.sentence('volumes.incomplete', catalogues, t);
    }

    static credit(catalogues: readonly string[], t: Translate): string {
        return VolumeCatalogues.sentence('volumes.credit', catalogues, t);
    }

    static suggests(source: string | null, title: string, t: Translate): string {
        return t(VolumeCatalogues.suggestions[source ?? ''] ?? 'volumes.suggests.bnf', { title });
    }

    private static sentence(
        key: 'volumes.reviewHint' | 'volumes.unavailable' | 'volumes.incomplete' | 'volumes.credit',
        catalogues: readonly string[],
        t: Translate,
        values: MessageValues = {},
    ): string {
        const known = catalogues.flatMap((name) => VolumeCatalogues.names[name] ?? []);
        const names = (known.length > 0 ? known : [VolumeCatalogues.names.bnf])
            .flatMap((name) => (name ? [t(name)] : []))
            .join(t('volumes.catalogue.and'));

        return t(known.length > 1 ? `${key}Many` : `${key}One`, { ...values, catalogues: names });
    }
}
