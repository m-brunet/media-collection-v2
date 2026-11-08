// One file of the application data, by its path relative to the data directory ('/' separated).
export interface DataFile {
    path: string;
    bytes: Uint8Array;
}
