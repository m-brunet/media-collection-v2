import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeDocument } from '../shared/appearance/color-scheme-document.util';
import '../shared/ui/styles';
import './leaf.css';
import { LeafApp } from './leaf-app';
import { PairingLink } from './pairing-link.util';

ColorSchemeDocument.restore();
const pairing = PairingLink.take(window.location, window.history);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LeafApp pairing={pairing} />
    </StrictMode>,
);
