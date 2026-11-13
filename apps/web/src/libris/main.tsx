import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorSchemeDocument } from '../shared/appearance/color-scheme-document.util';
import '../shared/ui/styles';
import './libris.css';
import { LibrisApp } from './libris-app';
import { Required } from '../shared/required.util';

ColorSchemeDocument.restore();

createRoot(Required.value(document.getElementById('root'), 'the page has a root element')).render(
    <StrictMode>
        <LibrisApp />
    </StrictMode>,
);
