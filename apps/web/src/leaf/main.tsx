import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeDocument } from '../shared/appearance/color-scheme-document.util';
import '../shared/ui/styles';
import './leaf.css';
import { LeafApp } from './leaf-app';

ColorSchemeDocument.restore();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LeafApp />
    </StrictMode>,
);
