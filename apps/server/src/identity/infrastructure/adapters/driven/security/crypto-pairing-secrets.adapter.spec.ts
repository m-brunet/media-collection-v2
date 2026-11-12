import { describe, expect, it } from 'vitest';
import { CryptoPairingSecrets } from './crypto-pairing-secrets.adapter.js';

describe('CryptoPairingSecrets', () => {
    it('generates 32 random bytes as base64url', () => {
        const secrets = new CryptoPairingSecrets();
        const previous = secrets.generate();

        const result = secrets.generate();

        expect(result).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(result).not.toBe(previous);
    });
    it('hashes a code the same way every time without keeping it', () => {
        const secrets = new CryptoPairingSecrets();
        const code = secrets.generate();

        const result = secrets.hash(code);

        expect(result).toBe(secrets.hash(code));
        expect(result).not.toContain(code);
    });
});
