import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import dashboardImg from '@/assets/images/dashboard.png';
import ss1 from '@/assets/images/ss1.PNG';
import ss2 from '@/assets/images/ss2.PNG';
import ss3 from '@/assets/images/ss3.PNG';

interface HeroProps {
    onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        console.log('Hero: Mounting PWA install listener');
        const handler = (e: any) => {
            console.log('Hero: beforeinstallprompt fired', e);
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        console.log('Hero: Install clicked');
        if (!deferredPrompt) {
            console.log('Hero: No deferred prompt available (app might be installed or not installable yet)');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
    };

    return (
        <section className="relative overflow-hidden w-full">
            {/* Background Elements */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-dot" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-3xl" />
            </div>

            {/* Full Height Intro Section */}
            <div className="min-h-screen flex items-center justify-center relative z-10 pt-20 pb-20">
                <div className="container px-4 md:px-6 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
                        {/* Left Column: Text & CTA */}
                        <div className="flex flex-col space-y-8 text-left z-20">
                            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 font-editorial">
                                Meet Supercomp, <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-600">
                                    Your transformation plan, from start to finish.
                                </span>
                            </h1>

                            <p className="text-xl text-muted-foreground max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 leading-relaxed font-sans">
                                Your workouts, meals, macros, and cardio — automatically planned and perfectly aligned with your goal. Snap a photo or scan a label to track your food instantly.
                            </p>

                            {/* Download Button */}
                            <button
                                onClick={handleInstallClick}
                                className="group flex items-center gap-4 bg-white text-black p-2 pr-6 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 w-fit cursor-pointer animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300"
                            >
                                <div className="relative w-12 h-12 shrink-0">
                                    <div className="absolute inset-0 bg-black/10 rounded-full blur-sm" />
                                    <img src="/pwa-512x512.png" alt="App Icon" className="relative w-full h-full object-cover rounded-full" />
                                </div>
                                <span className="font-bold text-lg tracking-tight">Download now</span>
                            </button>
                        </div>

                        {/* Right Column: Screenshots */}
                        {/* Desktop Layout */}
                        <div className="relative h-[600px] w-full hidden md:flex items-center justify-center animate-in fade-in zoom-in-95 duration-1000 delay-500 perspective-[2000px]">
                            {/* SS1 - Left Back */}
                            {/* SS1 - Left Back */}
                            <img
                                src={ss1}
                                alt="App Screenshot 1"
                                className="absolute left-16 top-0 w-[200px] rounded-[30px] border-[6px] border-white shadow-2xl -rotate-12 translate-y-12 z-10 transition-transform duration-500 hover:z-40 hover:scale-110 hover:rotate-0"
                            />
                            {/* SS2 - Center Front */}
                            <img
                                src={ss2}
                                alt="App Screenshot 2"
                                className="absolute left-1/2 -translate-x-1/2 top-8 w-[220px] rounded-[30px] border-[6px] border-white shadow-2xl z-20 transition-transform duration-500 hover:z-40 hover:scale-110"
                            />
                            {/* SS3 - Right Back */}
                            <img
                                src={ss3}
                                alt="App Screenshot 3"
                                className="absolute right-16 top-0 w-[200px] rounded-[30px] border-[6px] border-white shadow-2xl rotate-12 translate-y-12 z-10 transition-transform duration-500 hover:z-40 hover:scale-110 hover:rotate-0"
                            />
                        </div>

                        {/* Mobile Layout (simplified) */}
                        <div className="md:hidden relative h-[400px] w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-1000 delay-500">
                            <img
                                src={ss2}
                                alt="App Screenshot"
                                className="w-[240px] rounded-[30px] border-[4px] border-white shadow-2xl rotate-3"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Buttons & Dashboard */}
            <div className="container px-4 md:px-6 relative z-10 w-full flex flex-col items-center gap-12 pb-32">
                <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700">
                    <Button
                        size="lg"
                        onClick={onStart}
                        className="h-14 px-8 rounded-full text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300 font-sans"
                    >
                        Start Your Journey
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-14 px-8 rounded-full text-lg border-2 hover:bg-secondary/50 backdrop-blur-sm font-sans"
                    >
                        View Demo
                    </Button>
                </div>

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
        </section>
    );
}
