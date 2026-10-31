import type { TestAppContext } from './test-app-context.js';

export interface ApiFixture {
    save(context: TestAppContext): Promise<void>;
}
