// What a phone can do with one of the server's addresses.
export class ServerAddress {
    // The QR codes open Leaf, the phone application, at that address.
    static leaf(address: string): string {
        return new URL('/leaf/', address).href;
    }

    // On a phone, a loopback address points to the phone itself: its code could never work.
    static loopback(address: string): boolean {
        const host = new URL(address).hostname;

        return host === 'localhost' || host === '[::1]' || host.startsWith('127.');
    }
}
