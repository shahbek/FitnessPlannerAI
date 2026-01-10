import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingProps {
    onSelect: () => void;
}

export function Pricing({ onSelect }: PricingProps) {
    const [viewMode, setViewMode] = useState<'price' | 'coffee'>('coffee');

    const features = [
        "700 AI-powered tokens",
        "~7 complete transformation plans",
        "Personalized workouts & macros",
        "Shopping lists auto-generated",
        "Tokens never expire",
    ];

    return (
        <section id="pricing" className="py-24 md:py-32 relative overflow-hidden bg-background">
            <div className="container px-4 md:px-6">
                {/* Section Header */}
                <div className="text-center mb-12 space-y-4">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground font-editorial leading-tight">
                        Your Complete Transformation <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-orange-600">
                            For Less Than a Gym Day Pass
                        </span>
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground/80 max-w-xl mx-auto font-sans">
                        No subscriptions. No hidden fees. Pay once, transform forever.
                    </p>
                </div>

                {/* Apple-Style Toggle Control */}
                <div className="flex items-center justify-center gap-3 mb-8 animate-in fade-in zoom-in-95 duration-500 delay-200">
                    <span
                        className={cn(
                            "text-sm font-semibold transition-colors duration-300 font-sans cursor-pointer",
                            viewMode === 'price' ? "text-foreground" : "text-muted-foreground/60"
                        )}
                        onClick={() => setViewMode('price')}
                    >
                        $10
                    </span>

                    <button
                        onClick={() => setViewMode(prev => prev === 'coffee' ? 'price' : 'coffee')}
                        className={cn(
                            "w-12 h-7 rounded-full relative transition-colors duration-300 focus:outline-none shadow-sm",
                            viewMode === 'coffee' ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"
                        )}
                    >
                        <div
                            className={cn(
                                "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-spring",
                                viewMode === 'coffee' ? "translate-x-6" : "translate-x-1"
                            )}
                        />
                    </button>

                    <span
                        className={cn(
                            "text-2xl transition-all duration-300 cursor-pointer hover:scale-110",
                            viewMode === 'coffee' ? "opacity-100 scale-110 grayscale-0" : "opacity-50 grayscale scale-100"
                        )}
                        onClick={() => setViewMode('coffee')}
                    >
                        ☕
                    </span>
                </div>

                {/* Pricing Card - TypoTab Style Replica */}
                <div className="max-w-[400px] mx-auto">
                    <div className="relative p-8 md:p-10 rounded-[32px] bg-gradient-to-b from-[#F43E01] to-[#FF5E25] shadow-[0_20px_60px_-15px_rgba(244,62,1,0.3)] text-white overflow-hidden transition-transform duration-300 hover:scale-[1.02]">

                        {/* Premium Glossy Reflection Gradient */}
                        <div className="absolute top-0 left-0 w-full h-[120%] bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none z-0" />

                        <div className="relative z-10">
                            {/* Header Section */}
                            <div className="mb-8">
                                <h3 className="text-[32px] font-bold font-editorial mb-2 leading-tight tracking-tight">Transformation Pack</h3>
                                <p className="font-semibold text-white/90 text-lg">Flexible Start to Your Dream Body</p>
                            </div>

                            {/* Divider Line */}
                            <div className="w-full h-px bg-white/20 mb-8" />

                            {/* Dynamic Price/Anchor Section */}
                            <div className="mb-8 pl-1 min-h-[140px]">
                                {viewMode === 'coffee' ? (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-4xl filter drop-shadow-md">☕</span>
                                            <span className="text-xl font-medium text-white/90">/ one-time</span>
                                        </div>
                                        <p className="text-[15px] leading-relaxed text-white/80 font-medium max-w-[95%]">
                                            Trade one coffee for a complete body transformation—your future self will thank you.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-5xl font-bold font-sans tracking-tight">$10</span>
                                            <span className="text-xl font-medium text-white/90">/ one-time</span>
                                        </div>
                                        <p className="text-[15px] leading-relaxed text-white/80 font-medium max-w-[95%]">
                                            Full access to 700 AI tokens for less than a single drop-in gym visit.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Primary CTA Button - Pill Shape */}
                            <Button
                                onClick={onSelect}
                                className="w-full bg-white hover:bg-white/95 text-black hover:text-black shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)] rounded-full h-[52px] text-[17px] font-semibold mb-8 border-none transition-all active:scale-95"
                            >
                                Get Started
                            </Button>

                            {/* Feature List */}
                            <ul className="space-y-3">
                                {features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                            <Check className="w-3 h-3 text-[#F43E01] stroke-[3]" />
                                        </div>
                                        <span className="text-[15px] font-medium text-white/95 leading-snug">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Value Comparison */}
                <div className="mt-20 max-w-2xl mx-auto opacity-60 hover:opacity-100 transition-opacity duration-500">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm md:text-base">
                        <div className="p-4 rounded-2xl bg-muted/40 backdrop-blur-sm">
                            <div className="font-bold text-foreground mb-1">$150+</div>
                            <div className="text-xs md:text-sm text-muted-foreground">Trainer</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/40 backdrop-blur-sm">
                            <div className="font-bold text-foreground mb-1">$50/mo</div>
                            <div className="text-xs md:text-sm text-muted-foreground">Apps</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                            <div className="font-bold text-primary mb-1">$10</div>
                            <div className="text-xs md:text-sm text-foreground font-medium">Supercomp</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
