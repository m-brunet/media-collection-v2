import { expect, it } from 'vitest';
import { TlsAlpnChallenges } from './tls-alpn-challenges.adapter.js';

it('names an IP address challenge in reverse-DNS form', () => {
    const subject = { kind: 'address', name: '82.66.118.204' } as const;

    const name = TlsAlpnChallenges.serverName(subject);

    expect(name).toBe('204.118.66.82.in-addr.arpa');
});
it('names a domain challenge after the domain name', () => {
    const subject = { kind: 'domain', name: 'home.example.fr' } as const;

    const name = TlsAlpnChallenges.serverName(subject);

    expect(name).toBe('home.example.fr');
});
