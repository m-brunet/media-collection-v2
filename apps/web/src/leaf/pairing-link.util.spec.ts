import { describe, expect, it, vi } from 'vitest';
import { PairingLink } from './pairing-link.util';

const code = 'A'.repeat(43);

function browser(hash: string) {
    return {
        location: { hash, pathname: '/leaf/', search: '' },
        history: { state: null, replaceState: vi.fn() },
    };
}

describe('PairingLink', () => {
    it('takes the code after #pair=', () => {
        const { location, history } = browser('#pair=' + code);

        const result = PairingLink.take(location, history);

        expect(result).toBe(code);
    });
    it('removes the code from the address bar at once', () => {
        const { location, history } = browser('#pair=' + code);

        PairingLink.take(location, history);

        expect(history.replaceState).toHaveBeenCalledWith(null, '', '/leaf/');
    });
    it('removes a malformed code without using it', () => {
        const { location, history } = browser('#pair=short');

        const result = PairingLink.take(location, history);

        expect(result).toBeNull();
        expect(history.replaceState).toHaveBeenCalledWith(null, '', '/leaf/');
    });
    it('leaves an address without a code unchanged', () => {
        const { location, history } = browser('');

        const result = PairingLink.take(location, history);

        expect(result).toBeNull();
        expect(history.replaceState).not.toHaveBeenCalled();
    });
});
