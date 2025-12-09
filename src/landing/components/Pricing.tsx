import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PricingProps {
    onSelect: () => void;
}

export function Pricing({ onSelect }: PricingProps) {
    const features = [
        "700 AI tokens",
        "~7 complete fitness plans",
        "Personalized workouts & meals",
        "Shopping lists included",
        "Tokens never expire",
    ];

    return (
        <section id="pricing" className="py-24 relative">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-editorial">
                        Simple Pricing
                    </h2>
                    <p className="text-lg text-muted-foreground font-sans">
                        No subscriptions. Pay once, use whenever you need.
                    </p>
                </div>

                <div className="max-w-md mx-auto">
                    <div className="relative p-8 rounded-3xl border bg-white/80 backdrop-blur-xl border-primary/50 shadow-2xl">
                        <div className="mb-8 text-center">
                            <h3 className="text-xl font-bold mb-4 font-editorial">Starter Pack</h3>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-5xl font-bold font-sans">$10</span>
                                <span className="text-muted-foreground font-sans">one-time</span>
                            </div>
                            <div className="mt-3 inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold font-sans">
                                700 Tokens
                            </div>
                        </div>

                        <ul className="space-y-4 mb-8">
                            {features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-green-600" />
                                    </div>
                                    <span className="text-sm font-sans">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            onClick={onSelect}
                            className="w-full rounded-full h-12 font-sans shadow-lg shadow-primary/25"
                        >
                            Get Started
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
