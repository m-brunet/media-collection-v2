import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeDocument } from '../shared/appearance/color-scheme-document.util';
import '../shared/ui/styles';
import './leaf.css';
import { LeafApp } from './leaf-app';

// Start with the last known colour scheme; the installation's current one loads right after.
ColorSchemeDocument.restore();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LeafApp />
    </StrictMode>,
);
