import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
    {
        name: "Starter",
        price: "$10",
        period: "/one-time",
        tokens: "700 Tokens",
        description: "Perfect for trying out AI planning.",
        features: [
            "700 AI Tokens",
            "Generate ~1 Full Plan",
            "Basic Workout Generation",
            "Standard Meal Plans",
            "No Monthly Subscription"
        ],
        highlight: false
    },
    {
        name: "Professional",
        price: "$25",
        period: "/one-time",
        tokens: "2000 Tokens",
        description: "Best value for regular updates.",
        features: [
            "2000 AI Tokens",
            "Generate ~3 Full Plans",
            "Advanced AI Periodization",
            "Dynamic Plan Adjustments",
            "Priority Support"
        ],
        highlight: true
    },
    {
        name: "Enterprise",
        price: "$50",
        period: "/one-time",
        tokens: "4500 Tokens",
        description: "For coaches and power users.",
        features: [
            "4500 AI Tokens",
            "Generate ~7 Full Plans",
            "1-on-1 Coach Review",
            "Export to PDF",
            "Early Access Features"
        ],
        highlight: false
    }
];

interface PricingProps {
    onSelect: () => void;
}

export function Pricing({ onSelect }: PricingProps) {
    return (
        <section id="pricing" className="py-24 relative">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-editorial">
                        Pay As You Go
                    </h2>
                    <p className="text-lg text-muted-foreground font-sans">
                        No monthly subscriptions. Purchase tokens and use them whenever you need.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan, index) => (
                        <div
                            key={index}
                            className={cn(
                                "relative p-8 rounded-3xl border transition-all duration-300 flex flex-col",
                                plan.highlight
                                    ? "bg-white/80 backdrop-blur-xl border-primary/50 shadow-2xl scale-105 z-10"
                                    : "bg-white/40 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl"
                            )}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-medium font-sans">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-bold mb-2 font-editorial">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold font-sans">{plan.price}</span>
                                    {plan.period && <span className="text-muted-foreground font-sans">{plan.period}</span>}
                                </div>
                                <div className="mt-2 inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold font-sans">
                                    {plan.tokens}
                                </div>
                                <p className="text-muted-foreground mt-4 font-sans">{plan.description}</p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features.map((feature, i) => (
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
                                variant={plan.highlight ? "default" : "outline"}
                                className={cn(
                                    "w-full rounded-full h-12 font-sans",
                                    plan.highlight ? "shadow-lg shadow-primary/25" : ""
                                )}
                            >
                                Choose {plan.name}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
