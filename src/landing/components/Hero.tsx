import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import dashboardImg from '@/assets/images/dashboard.png';
import ss1 from '@/assets/images/ss1.png';
import ss2 from '@/assets/images/ss2.png';
import ss3 from '@/assets/images/ss3.png';

// Floating Emojis Component
function FloatingEmojis() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth) * 2 - 1,
                y: (e.clientY / window.innerHeight) * 2 - 1
            });
        };

        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const emojis = [
        { icon: "🍎", top: "25%", left: "15%", delay: "0s", factor: 15, size: "text-5xl" },   // Nutrition (Top Left)
        { icon: "🏋️", top: "25%", right: "15%", delay: "1s", factor: -15, size: "text-6xl" }, // Workout (Top Right)
        { icon: "📝", top: "40%", right: "10%", delay: "0.5s", factor: -20, size: "text-5xl" }, // Plan (Mid Right)
        { icon: "🥑", top: "40%", left: "10%", delay: "2s", factor: 20, size: "text-5xl" },   // Macros (Mid Left)
        { icon: "🥦", top: "12%", right: "45%", delay: "1.5s", factor: 10, size: "text-4xl" }, // Health (Top Center)
    ];

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {emojis.map((item: any, i) => (
                <div
                    key={i}
                    className={`absolute ${item.size} animate-float`}
                    style={{
                        top: item.top,
                        left: item.left,
                        right: item.right,
                        transform: `translate(${mousePos.x * item.factor}px, ${mousePos.y * item.factor + (scrollY * 0.1 * (item.factor > 0 ? 1 : -1))}px)`
                    }}
                >
                    <div className="animate-float" style={{ animationDelay: item.delay }}>
                        {item.icon}
                    </div>
                </div>
            ))}
        </div>
    );
}

interface HeroProps {
    onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

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
        <section className="relative overflow-hidden w-full bg-background selection:bg-primary/30 min-h-screen flex flex-col justify-center pt-20">
            {/* Premium Background Effects */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-orange-200/20 rounded-full blur-[100px]" />
            </div>

            {/* Interactive Floating Emojis */}
            <FloatingEmojis />

            {/* Main Content Container */}
            {/* Main Content Container - Centered Vertically in Viewport */}
            <div className="container px-4 md:px-6 w-full relative z-10 min-h-[90vh] flex flex-col justify-center items-center">
                <div className="flex flex-col items-center justify-center max-w-5xl mx-auto">
                    {/* Hero Text & CTA */}
                    <div className="flex flex-col space-y-8 text-center z-20 items-center">
                        <div className="space-y-4 flex flex-col items-center">
                            <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                <span className="flex w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                                AI-Powered Body Transformation
                            </div>

                            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 font-sans leading-[1.1] flex flex-col items-center">
                                <span>Your Dream</span>
                                <span>Physique,</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-orange-600">
                                    Zero
                                </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-orange-600">
                                    Guesswork.
                                </span>
                            </h1>
                        </div>

                        <p className="text-xl text-muted-foreground/90 max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 leading-relaxed font-sans">
                            Stop planning. Start transforming. The AI that builds your perfect meal plan and workout routine instantly.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 w-full md:w-auto">

                            {/* PWA Install Button - Pill Style */}
                            <button
                                onClick={handleInstallClick}
                                className={`group flex items-center gap-3 px-8 h-16 rounded-full bg-white text-black border border-black/5 shadow-[inset_0_-4px_4px_rgba(0,0,0,0.05),0_10px_20px_rgba(0,0,0,0.1)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] hover:scale-105 transition-all duration-300
                                    ${isInstalled ? 'opacity-75' : ''}
                                `}
                            >
                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm">
                                    <img
                                        src="/pwa-512x512.png"
                                        alt="App Icon"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="font-medium text-foreground text-sm text-left leading-tight">
                                    {isInstalled ? 'Open App' : isIOS() ? 'Install on iOS' : 'Download App'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Preview Section */}
            <div className="container px-4 md:px-6 relative z-10 w-full flex flex-col items-center gap-12 pb-20 mt-12">
                {/* Abstract UI Mockup Representation */}
                <div className="w-full max-w-5xl mx-auto relative animate-in fade-in zoom-in-95 duration-1000 delay-1000">
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black">
                        <div className="aspect-[2560/1664] w-full relative group cursor-pointer" onClick={() => !isPlaying && setIsPlaying(true)}>
                            {!isPlaying ? (
                                <>
                                    <img
                                        src={dashboardImg}
                                        alt="Interactive Dashboard Preview"
                                        className="w-full h-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
                                    />
                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110">
                                            <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1.5" />
                                        </div>
                                        <span className="absolute mt-28 text-white font-medium text-lg tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-md">
                                            Watch Demo
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <iframe
                                    className="w-full h-full"
                                    src="https://www.youtube.com/embed/UdqpjrjwZh0?autoplay=1&rel=0"
                                    title="Supercomp Demo"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            )}
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
