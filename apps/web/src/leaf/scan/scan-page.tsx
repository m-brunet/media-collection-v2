import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { LeafPage } from '../leaf-page';
import type { BarcodeReader } from './barcode-reader-context';
import { useBarcodeReader } from './barcode-reader-context';
import { ScannedIsbn } from './scanned-isbn.util';

type Mode = 'live' | 'photo' | 'camera-unavailable';

// What the barcodes found in one picture amount to.
type Reading = { kind: 'isbn'; isbn: string } | { kind: 'not-isbn' } | { kind: 'none' };

async function readIsbn(reader: BarcodeReader, source: HTMLVideoElement | Blob): Promise<Reading> {
    const values = await reader.read(source);
    const isbn = values.map((value) => ScannedIsbn.from(value)).find((value) => value !== null);

    if (isbn) {
        return { kind: 'isbn', isbn };
    }

    return values.length > 0 ? { kind: 'not-isbn' } : { kind: 'none' };
}

// Browsers give live camera video only to secure pages (HTTPS, or the computer itself).
function liveCameraPossible(): boolean {
    return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

function useScanned() {
    const navigate = useNavigate();

    return useCallback(
        (isbn: string) => void navigate('/scan/found', { state: { isbn } }),
        [navigate],
    );
}

function BackHome() {
    const { t } = useI18n();

    return (
        <Link to="/" className="button button--secondary">
            <span>{t('leaf.scan.backHome')}</span>
        </Link>
    );
}

// Live viewfinder: frames are read on the phone until an ISBN barcode shows up.
function LiveScanner({ onUnavailable }: { onUnavailable(): void }) {
    const { t } = useI18n();
    const reader = useBarcodeReader();
    const scanned = useScanned();
    const video = useRef<HTMLVideoElement>(null);
    const [started, setStarted] = useState(false);
    const [notIsbn, setNotIsbn] = useState(false);

    useEffect(() => {
        let active = true;
        let stream: MediaStream | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const scan = async () => {
            if (!active || !video.current) {
                return;
            }

            const reading = await readIsbn(reader, video.current).catch((): Reading => ({
                kind: 'none',
            }));

            if (!active) {
                return;
            }

            if (reading.kind === 'isbn') {
                scanned(reading.isbn);

                return;
            }

            setNotIsbn(reading.kind === 'not-isbn');
            timer = setTimeout(() => void scan(), 250);
        };

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then((media) => {
                stream = media;

                if (!active) {
                    media.getTracks().forEach((track) => track.stop());

                    return;
                }

                if (video.current) {
                    video.current.srcObject = media;
                }

                setStarted(true);
                void scan();
            })
            .catch(() => active && onUnavailable());

        return () => {
            active = false;
            clearTimeout(timer);
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, [reader, scanned, onUnavailable]);

    return (
        <>
            <p>{t('leaf.scan.live')}</p>
            <div className="leaf-scan__viewfinder">
                <video
                    ref={video}
                    className="leaf-scan__video"
                    aria-label={t('leaf.scan.videoLabel')}
                    autoPlay
                    muted
                    playsInline
                />
                <div className="leaf-scan__guide" aria-hidden="true" />
            </div>
            {!started && <LoadingState label={t('leaf.scan.starting')} />}
            {notIsbn && <Notice tone="warning">{t('leaf.scan.notIsbn')}</Notice>}
            <p className="muted">{t('leaf.scan.liveHint')}</p>
            <BackHome />
        </>
    );
}

// Without live video (a plain-HTTP page on the home network): one photo taken with the phone's
// camera app, read on the phone and then dropped. Only the ISBN found is kept.
function PhotoScanner() {
    const { t } = useI18n();
    const reader = useBarcodeReader();
    const scanned = useScanned();
    const input = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<'ready' | 'reading' | 'none' | 'not-isbn'>('ready');

    async function read(file: File) {
        setState('reading');
        const reading = await readIsbn(reader, file).catch((): Reading => ({ kind: 'none' }));

        if (reading.kind === 'isbn') {
            scanned(reading.isbn);
        } else {
            setState(reading.kind);
        }
    }

    const failed = state === 'none' || state === 'not-isbn';

    return (
        <>
            {failed ? (
                <Notice tone="error">
                    <strong>{t('leaf.scan.noBarcodeTitle')}</strong>
                    <p>{t(state === 'none' ? 'leaf.scan.noBarcode' : 'leaf.scan.notIsbn')}</p>
                </Notice>
            ) : (
                <>
                    <p>{t('leaf.scan.photo')}</p>
                    <p className="muted">{t('leaf.scan.photoHint')}</p>
                </>
            )}
            <input
                ref={input}
                className="visually-hidden"
                type="file"
                accept="image/*"
                capture="environment"
                aria-label={t('leaf.scan.photoInput')}
                tabIndex={-1}
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    event.target.value = '';

                    if (file) {
                        void read(file);
                    }
                }}
            />
            {state === 'reading' ? (
                <LoadingState label={t('leaf.scan.reading')} />
            ) : (
                <Button variant="primary" icon="scan" onClick={() => input.current?.click()}>
                    {failed ? t('leaf.retry') : t('leaf.scan.takePhoto')}
                </Button>
            )}
            <BackHome />
        </>
    );
}

function CameraUnavailable({ onRetry }: { onRetry(): void }) {
    const { t } = useI18n();

    return (
        <>
            <Notice tone="error">{t('leaf.scan.cameraUnavailableBody')}</Notice>
            <Button variant="primary" onClick={onRetry}>
                {t('leaf.retry')}
            </Button>
            <BackHome />
        </>
    );
}

// Scanning is the only way into the mobile add form: no ISBN can be typed on the phone.
export function ScanPage() {
    const { t } = useI18n();
    const [mode, setMode] = useState<Mode>(() => (liveCameraPossible() ? 'live' : 'photo'));
    const unavailable = useCallback(() => setMode('camera-unavailable'), []);

    return (
        <LeafPage
            back={{ to: '/', label: t('leaf.back.home') }}
            title={
                mode === 'camera-unavailable'
                    ? t('leaf.scan.cameraUnavailable')
                    : t('leaf.scan.title')
            }
        >
            {mode === 'live' && <LiveScanner onUnavailable={unavailable} />}
            {mode === 'photo' && <PhotoScanner />}
            {mode === 'camera-unavailable' && (
                <CameraUnavailable onRetry={() => setMode('photo')} />
            )}
        </LeafPage>
    );
}
