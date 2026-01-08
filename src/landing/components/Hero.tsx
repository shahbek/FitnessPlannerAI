import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import dashboardImg from '@/assets/images/dashboard.png';
import ss1 from '@/assets/images/ss1.png';
import ss2 from '@/assets/images/ss2.png';
import ss3 from '@/assets/images/ss3.png';

interface HeroProps {
    onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    useEffect(() => {
        // Check if app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA: App is already installed');
            setIsInstalled(true);
            return;
        }

        console.log('PWA: Setting up install listener');
        const handler = (e: any) => {
            console.log('PWA: beforeinstallprompt fired', e);
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed via appinstalled event
        window.addEventListener('appinstalled', () => {
            console.log('PWA: App was installed');
            setIsInstalled(true);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);


    const isIOS = () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    };

    const handleInstallClick = async () => {
        console.log('PWA: Install button clicked');

        // Check if already installed
        if (isInstalled) {
            console.log('PWA: App is already installed');
            alert('Supercomp is already installed on your device!');
            return;
        }

        // iOS devices need manual installation
        if (isIOS()) {
            console.log('PWA: iOS device detected, showing manual instructions');
            setShowIOSInstructions(true);
            return;
        }

        // Try to use the deferred prompt
        if (!deferredPrompt) {
            console.log('PWA: No deferred prompt available');
            // Provide helpful fallback message
            alert(
                'To install Supercomp:\n\n' +
                '1. Click the menu (⋮) in your browser\n' +
                '2. Select "Install app" or "Add to Home screen"\n\n' +
                'Note: Make sure you\'re using Chrome, Edge, or Safari on a supported device.'
            );
            return;
        }

        try {
            console.log('PWA: Showing install prompt');
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA: User response: ${outcome}`);

            if (outcome === 'accepted') {
                setIsInstalled(true);
            }

            setDeferredPrompt(null);
        } catch (error) {
            console.error('PWA: Error showing install prompt:', error);
        }
    };


    return (
        <section className="relative overflow-hidden w-full">
            {/* Background Elements */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-dot" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-3xl" />
            </div>

            {/* Main Content Container - Natural Flow, No Forced Height */}
            <div className="container px-4 md:px-6 w-full pt-32 pb-12 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center max-w-7xl mx-auto">

                    {/* Left Column: Text & Download Button */}
                    <div className="flex flex-col space-y-8 text-center md:text-left z-20 items-center md:items-start">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 font-editorial leading-tight">
                            Meet Supercomp, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-600">
                                Your transformation plan, from start to finish.
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 leading-relaxed font-sans">
                            Your workouts, meals, macros, and cardio — automatically planned and perfectly aligned with your goal. Snap a photo or scan a label to track your food instantly.
                        </p>

                        {/* Download Button - Standardized App Icon Style (All Screens) */}
                        <div className="flex justify-center md:justify-start animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                            <button
                                onClick={handleInstallClick}
                                className={`group flex flex-col items-center gap-3 transition-all duration-300 cursor-pointer hover:scale-105
                                    ${isInstalled ? 'opacity-75' : ''}
                                `}
                            >
                                {/* Icon Container - Sized for Mobile (w-16) and Desktop (w-20) */}
                                <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 shadow-xl rounded-2xl md:rounded-[22px]">
                                    <img
                                        src="/pwa-512x512.png"
                                        alt="App Icon"
                                        className="relative w-full h-full object-cover rounded-2xl md:rounded-[22px]"
                                    />
                                </div>

                                {/* Label Text */}
                                <span className="font-bold text-sm md:text-base tracking-tight text-center leading-tight">
                                    {isInstalled ? 'Opened' :
                                        isIOS() ? 'Add to\nHome Screen' : 'Download\nnow'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Screenshots */}
                    <div className="relative w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-1000 delay-500 perspective-[2000px] mt-8 md:mt-0">
                        {/* Mobile Screenshots Layout (Stacked) */}
                        <div className="md:hidden relative h-[400px] w-full max-w-sm flex items-center justify-center">
                            <img
                                src={ss1}
                                alt="App Screenshot 1"
                                className="absolute left-0 w-[45%] rounded-[30px] border-[4px] border-white shadow-2xl -rotate-6 translate-y-8 z-10"
                            />
                            <img
                                src={ss2}
                                alt="App Screenshot 2"
                                className="absolute left-1/2 -translate-x-1/2 w-[50%] rounded-[30px] border-[4px] border-white shadow-2xl z-20"
                            />
                            <img
                                src={ss3}
                                alt="App Screenshot 3"
                                className="absolute right-0 w-[45%] rounded-[30px] border-[4px] border-white shadow-2xl rotate-6 translate-y-8 z-10"
                            />
                        </div>

                        {/* Desktop Screenshots Layout (Interactive) */}
                        <div className="hidden md:flex relative h-[600px] w-full items-center justify-center">
                            <img
                                src={ss1}
                                alt="App Screenshot 1"
                                className="absolute left-16 top-0 w-[200px] rounded-[30px] border-[6px] border-white shadow-2xl -rotate-12 translate-y-12 z-10 transition-transform duration-500 hover:z-40 hover:scale-110 hover:rotate-0"
                            />
                            <img
                                src={ss2}
                                alt="App Screenshot 2"
                                className="absolute left-1/2 -translate-x-1/2 top-8 w-[220px] rounded-[30px] border-[6px] border-white shadow-2xl z-20 transition-transform duration-500 hover:z-40 hover:scale-110"
                            />
                            <img
                                src={ss3}
                                alt="App Screenshot 3"
                                className="absolute right-16 top-0 w-[200px] rounded-[30px] border-[6px] border-white shadow-2xl rotate-12 translate-y-12 z-10 transition-transform duration-500 hover:z-40 hover:scale-110 hover:rotate-0"
                            />
                        </div>
                    </div>
                </div>

                {/* Start Journey Button - Centered Below Grid */}
                <div className="w-full flex justify-center mt-12 md:mt-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700">
                    <Button
                        size="lg"
                        onClick={onStart}
                        className="h-14 px-12 rounded-full text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300 font-sans"
                    >
                        Start Your Journey
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Dashboard Preview Section */}
            <div className="container px-4 md:px-6 relative z-10 w-full flex flex-col items-center gap-12 pb-20 mt-12">
                {/* Abstract UI Mockup Representation */}
                <div className="w-full max-w-5xl mx-auto relative animate-in fade-in zoom-in-95 duration-1000 delay-1000">
                    <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-white/30 backdrop-blur-md p-2">
                        <div className="rounded-xl overflow-hidden bg-background/50 aspect-[16/9] flex items-center justify-center relative">
                            <img
                                src={dashboardImg}
                                alt="Interactive Dashboard Preview"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* iOS Installation Instructions Modal */}
            {showIOSInstructions && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowIOSInstructions(false)}>
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold mb-4 text-black">Install Supercomp on iOS</h3>
                        <div className="space-y-4 text-gray-700">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="font-bold text-primary">1</span>
                                </div>
                                <p>Tap the <strong>Share</strong> button <span className="inline-block">📤</span> at the bottom of Safari</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="font-bold text-primary">2</span>
                                </div>
                                <p>Scroll down and tap <strong>"Add to Home Screen"</strong> <span className="inline-block">➕</span></p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="font-bold text-primary">3</span>
                                </div>
                                <p>Tap <strong>"Add"</strong> in the top right corner</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowIOSInstructions(false)}
                            className="mt-6 w-full bg-primary text-white py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
