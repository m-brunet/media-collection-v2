import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { account, deviceLanguages, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import type { BarcodeReader } from './barcode-reader-context';
import { BarcodeReaderContext } from './barcode-reader-context';
import { ScanPage } from './scan-page';

// Answers each reading with the next scripted list of barcode values, then nothing.
class ScriptedReader implements BarcodeReader {
    readonly sources: (HTMLVideoElement | Blob)[] = [];

    constructor(private readonly results: string[][]) {}

    async read(source: HTMLVideoElement | Blob): Promise<string[]> {
        this.sources.push(source);

        return this.results.shift() ?? [];
    }
}

function cameraPage(secure: boolean, getUserMedia?: () => Promise<MediaStream>) {
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
        value: getUserMedia ? { getUserMedia } : undefined,
        configurable: true,
    });
}

function camera() {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;

    return { track, getUserMedia: vi.fn(async () => stream) };
}

function open(reader: BarcodeReader) {
    return renderRoute('/scan', {
        '/scan': (
            <BarcodeReaderContext.Provider value={reader}>
                <ScanPage />
            </BarcodeReaderContext.Provider>
        ),
    });
}

const photo = new File([new Uint8Array([1, 2, 3])], 'barcode.jpg', { type: 'image/jpeg' });

beforeEach(() => {
    deviceLanguages(['en-GB']);
    new FakeApi().signedIn(account());
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('asks for a photo of the barcode when live video is not allowed', async () => {
    cameraPage(false);

    open(new ScriptedReader([]));

    expect(
        await screen.findByRole('button', { name: 'Take a photo of the barcode' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('continues with the ISBN read from the photo', async () => {
    cameraPage(false);
    const reader = new ScriptedReader([['9781635575637']]);

    open(reader);

    await userEvent.upload(screen.getByLabelText('Photo of the barcode'), photo);

    expect(await screen.findByText('Elsewhere: /scan/found')).toBeInTheDocument();
    expect(reader.sources).toEqual([photo]);
});

it('explains a photo without a barcode and offers Retry or Back to home only', async () => {
    cameraPage(false);
    open(new ScriptedReader([[]]));

    await userEvent.upload(screen.getByLabelText('Photo of the barcode'), photo);

    expect(await screen.findByText('No ISBN barcode found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('explains a photo of a barcode that is not an ISBN', async () => {
    cameraPage(false);
    open(new ScriptedReader([['3017620422003']]));

    await userEvent.upload(screen.getByLabelText('Photo of the barcode'), photo);

    expect(
        await screen.findByText(
            'This barcode is not an ISBN. Scan the barcode that starts with 978 or 979.',
        ),
    ).toBeInTheDocument();
});

it('continues with the ISBN read from the live camera and stops the camera', async () => {
    const { track, getUserMedia } = camera();

    cameraPage(true, getUserMedia);

    open(new ScriptedReader([['9781635575637']]));

    expect(await screen.findByText('Elsewhere: /scan/found')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
        audio: false,
    });
    expect(track.stop).toHaveBeenCalled();
});

it('keeps scanning with a hint when the camera sees a barcode that is not an ISBN', async () => {
    const { getUserMedia } = camera();

    cameraPage(true, getUserMedia);

    open(new ScriptedReader([['3017620422003']]));

    expect(
        await screen.findByText(
            'This barcode is not an ISBN. Scan the barcode that starts with 978 or 979.',
        ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Camera view')).toBeInTheDocument();
});

it('explains a refused camera and offers Retry or Back to home only', async () => {
    cameraPage(true, async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
    });

    open(new ScriptedReader([]));

    expect(await screen.findByRole('heading', { name: 'Camera unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('retries a refused camera with a photo of the barcode', async () => {
    cameraPage(true, async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
    });
    open(new ScriptedReader([]));

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('button', { name: 'Take a photo of the barcode' })).toBeInTheDocument();
});
