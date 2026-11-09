export interface KeepAwakeReader {
    read(): Promise<boolean>;
}
