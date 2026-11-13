export class PairingLink {
    private static readonly pattern = /^#pair=([A-Za-z0-9_-]{43})$/;

    static take(
        location: Pick<Location, 'hash' | 'pathname' | 'search'>,
        history: Pick<History, 'replaceState' | 'state'>,
    ): string | null {
        if (!location.hash.startsWith('#pair=')) {
            return null;
        }

        const code = PairingLink.pattern.exec(location.hash)?.[1] ?? null;

        history.replaceState(history.state, '', location.pathname + location.search);

        return code;
    }
}
