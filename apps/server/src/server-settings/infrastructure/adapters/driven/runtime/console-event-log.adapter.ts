import type { EventLog } from '../../../../application/ports/driven/event-log.interface.js';

export class ConsoleEventLog implements EventLog {
    write(line: string): void {
        console.log(line);
    }
}
