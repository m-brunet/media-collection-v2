import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { desktopWindow } from '../api/client.js';

export const viewports = {
    minimumDesktop: { width: 1280, height: 720 },
    referenceDesktop: { width: 1440, height: 900 },
    phone: { width: 390, height: 844 },
};

// Real Chromium for frontend end-to-end tests. Install it once with `npx playwright install chromium`.
export class BrowserFixture {
    private browser: Browser | undefined;
    private readonly contexts: BrowserContext[] = [];

    async launch(args: string[] = []): Promise<void> {
        this.browser = await chromium.launch({ args });
    }

    async page(
        base: string,
        options: {
            viewport?: { width: number; height: number };
            locale?: string;
            // Behave like the Electron window (sends its setup secret) rather than a plain browser.
            desktopWindow?: boolean;
            permissions?: string[];
            beforeLoad?: string;
        } = {},
    ): Promise<Page> {
        if (!this.browser) {
            throw new Error('BrowserFixture.launch() must run first.');
        }

        const context = await this.browser.newContext({
            baseURL: base,
            viewport: options.viewport ?? viewports.minimumDesktop,
            locale: options.locale ?? 'en-GB',
            timezoneId: 'Europe/Paris',
            extraHTTPHeaders: options.desktopWindow ? desktopWindow : undefined,
        });

        this.contexts.push(context);
        await context.grantPermissions(options.permissions ?? []);

        if (options.beforeLoad) {
            await context.addInitScript(options.beforeLoad);
        }

        return context.newPage();
    }

    async closeContexts(): Promise<void> {
        await Promise.all(this.contexts.splice(0).map((context) => context.close()));
    }

    async close(): Promise<void> {
        await this.closeContexts();
        await this.browser?.close();
    }
}

// Optional visual review: set MC_SCREENSHOT_DIR to keep screenshots of the tested pages.
export async function capture(page: Page, name: string): Promise<void> {
    const directory = process.env.MC_SCREENSHOT_DIR;

    if (directory) {
        await page.screenshot({ path: join(directory, name + '.png'), fullPage: true });
    }
}
