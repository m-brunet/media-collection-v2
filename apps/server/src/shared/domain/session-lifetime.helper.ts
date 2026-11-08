// How long a signed-in session lasts without activity: 24 hours. Authenticated actions renew it.
// The session token and its cookie both use this lifetime, so they always expire together.
export class SessionLifetime {
    static readonly seconds = 24 * 60 * 60;
    static readonly milliseconds = SessionLifetime.seconds * 1000;
}
