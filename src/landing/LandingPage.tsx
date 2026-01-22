import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';

import { FreeCalculator } from './components/FreeCalculator';

interface LandingPageProps {
    onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
            <Helmet>
                <title>Supercomp - AI Body Transformation</title>
                <meta name="description" content="Your Dream Physique, Zero Guesswork. The AI that builds your perfect meal plan and workout routine instantly." />

                {/* Open Graph */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://supercomp.ai" />
                <meta property="og:title" content="Supercomp - AI Body Transformation" />
                <meta property="og:description" content="Your Dream Physique, Zero Guesswork. The AI that builds your perfect meal plan and workout routine instantly." />
                <meta property="og:image" content="https://supercomp.ai/api/og" />
                <meta property="og:site_name" content="Supercomp" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content="https://supercomp.ai/api/og" />
            </Helmet>
            <Header onLogin={onLogin} />
            <main>
                <Hero onStart={onLogin} />
                <HowItWorks />
                <FreeCalculator onLogin={onLogin} />
                <Testimonials />
                <Pricing onSelect={onLogin} />
                <FAQ />
            </main>
            <Footer />
        </div>
    );
}

