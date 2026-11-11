import { expect, it } from 'vitest';
import { BackgroundMode } from './background-mode.service.js';

it('reveals the window on launch when started by hand', () => {
    const mode = new BackgroundMode(true, false);

    const result = mode.revealsOnLaunch();

    expect(result).toBe(true);
});
it('keeps the window hidden on the first launch when started hidden at sign-in', () => {
    const mode = new BackgroundMode(true, true);

    const result = mode.revealsOnLaunch();

    expect(result).toBe(false);
});
it('reveals the window on a later launch after a hidden start', () => {
    const mode = new BackgroundMode(true, true);

    mode.revealsOnLaunch();

    const result = mode.revealsOnLaunch();

    expect(result).toBe(true);
});
it('reveals the window on launch without a tray, even when asked to start hidden', () => {
    const mode = new BackgroundMode(false, true);

    const result = mode.revealsOnLaunch();

    expect(result).toBe(true);
});
it('keeps running in the tray when the window is closed', () => {
    const mode = new BackgroundMode(true, false);

    const result = mode.keepsRunningOnClose(false);

    expect(result).toBe(true);
});
it('lets the window close when quitting', () => {
    const mode = new BackgroundMode(true, false);

    const result = mode.keepsRunningOnClose(true);

    expect(result).toBe(false);
});
it('lets the window close without a tray', () => {
    const mode = new BackgroundMode(false, false);

    const result = mode.keepsRunningOnClose(false);

    expect(result).toBe(false);
});
