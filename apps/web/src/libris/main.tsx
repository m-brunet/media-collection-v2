import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/ui/styles';
import './libris.css';
import { LibrisApp } from './libris-app';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LibrisApp />
    </StrictMode>,
);
