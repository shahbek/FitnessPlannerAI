import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import dashboardImg from '@/assets/images/dashboard.png';

interface HeroProps {
    onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-32 pb-32 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-dot" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-3xl" />
            </div>

            <div className="container px-4 md:px-6 relative z-10">
                <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 font-editorial">
                        Your Personal Trainer, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-600">
                            Reimagined with AI
                        </span>
                    </h1>

                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 leading-relaxed font-sans">
                        Supercomp creates hyper-personalized workout and meal plans that adapt to your progress.
                        Experience the future of fitness planning with a design that feels as good as it looks.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
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
                    <div className="mt-16 w-full max-w-5xl mx-auto relative animate-in fade-in zoom-in-95 duration-1000 delay-500">
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
            </div>
        </section>
    );
}
