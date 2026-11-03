import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/ui/styles';
import './leaf.css';
import { LeafApp } from './leaf-app';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LeafApp />
    </StrictMode>,
);
