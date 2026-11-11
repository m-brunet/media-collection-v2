import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TrayNotice } from './tray-notice.adapter.js';

let profile: string;

beforeEach(() => {
    profile = mkdtempSync(join(tmpdir(), 'tray-notice-'));
});
afterEach(() => {
    rmSync(profile, { recursive: true, force: true });
});

it('is due before it was ever shown', () => {
    const notice = new TrayNotice(profile);

    const result = notice.due();

    expect(result).toBe(true);
});
it('is no longer due once shown', () => {
    const notice = new TrayNotice(profile);

    notice.shown();

    expect(notice.due()).toBe(false);
});
it('stays shown for the next start of the application', () => {
    new TrayNotice(profile).shown();

    const result = new TrayNotice(profile).due();

    expect(result).toBe(false);
});
