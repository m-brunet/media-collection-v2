export class ApplicationLabel {
    constructor(private readonly packaged: boolean) {}

    of(name: string): string {
        return this.packaged ? name : name + ' (dev)';
    }
}
