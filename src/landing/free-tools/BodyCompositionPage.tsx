import React from 'react';
import { Header } from '@/landing/components/Header';
import { Footer } from '@/landing/components/Footer';
import { BodyCompositionAnalyzer } from './BodyCompositionAnalyzer';

interface BodyCompositionPageProps {
    onLogin: () => void;
}

export function BodyCompositionPage({ onLogin }: BodyCompositionPageProps) {
    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
            <Header onLogin={onLogin} />
            <main>
                <BodyCompositionAnalyzer />
            </main>
            <Footer />
        </div>
    );
}

// Default export for lazy loading
export default BodyCompositionPage;
