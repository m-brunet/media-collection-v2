// Updates come from the public GitHub releases, which an application can only read once the
// repository is public. While Media Collection is tried in house, nothing is checked: the File menu
// shows the update item, disabled. Set to true when the repository goes public.
export class UpdateChannel {
    static readonly published: boolean = false;
}
