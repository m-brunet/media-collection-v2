// Recognises requests made from the computer running Media Collection itself (the Electron
// window or a browser on the same machine), as opposed to the network or the internet.
export class LocalRequest {
    private static readonly loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

    static isLocal(remoteAddress: string | undefined): boolean {
        return remoteAddress !== undefined && LocalRequest.loopback.has(remoteAddress);
    }
}
