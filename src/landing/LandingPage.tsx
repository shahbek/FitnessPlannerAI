import React from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';

interface LandingPageProps {
    onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
            <Header onLogin={onLogin} />
            <main>
                <Hero onStart={onLogin} />
                <HowItWorks />
                <Testimonials />
                <Pricing onSelect={onLogin} />
                <FAQ />
            </main>
            <Footer />
        </div>
    );
}

