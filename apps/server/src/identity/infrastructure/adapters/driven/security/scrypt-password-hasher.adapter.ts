import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../../../../application/ports/driven/password-hasher.interface.js';

export class ScryptPasswordHasher implements PasswordHasher {
    async hash(password: string): Promise<string> {
        const salt = randomBytes(16);

        return (
            'scrypt-32768-8-1:' +
            salt.toString('base64url') +
            ':' +
            (await this.derive(password, salt)).toString('base64url')
        );
    }

    async matches(password: string, hash: string): Promise<boolean> {
        const [format, salt, digest] = hash.split(':');

        if (format !== 'scrypt-32768-8-1' || !salt || !digest) {
            return false;
        }

        const expected = Buffer.from(digest, 'base64url');

        if (expected.length !== 64) {
            return false;
        }

        const actual = await this.derive(password, Buffer.from(salt, 'base64url'));

        return timingSafeEqual(actual, expected);
    }

    private derive(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            scrypt(
                password,
                salt,
                64,
                { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
                (error, key) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(key);
                    }
                },
            );
        });
    }
}
