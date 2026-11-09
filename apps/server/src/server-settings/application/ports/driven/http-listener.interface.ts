// The port the HTTP listener actually runs on (the saved port, or a command-line or environment
// override). The HTTP router rule and address follow it.
export interface HttpListener {
    port(): number;
}
