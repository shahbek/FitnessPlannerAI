import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
    question: string;
    answer: string;
}

const faqItems: FAQItem[] = [
    {
        question: "Is my data private and secure?",
        answer: "Absolutely. Your data is encrypted end-to-end and stored securely. We never sell or share your personal information with third parties. Your transformation is your business, not ours."
    },
    {
        question: "Do my tokens expire?",
        answer: "No, your tokens never expire. Use them whenever you're ready to generate a new plan — whether that's tomorrow or next year."
    },
    {
        question: "How accurate are the AI-generated plans?",
        answer: "Our AI is trained on peer-reviewed nutrition science and proven exercise physiology. Every plan is tailored to your body metrics, goals, and preferences. We're not guessing — we're calculating."
    },
    {
        question: "Can I customize my meal plan?",
        answer: "Yes! You can swap meals, adjust portion sizes, and set dietary restrictions. The AI adapts to your preferences while keeping your macros on point."
    },
    {
        question: "What happens if I hit a plateau?",
        answer: "The AI monitors your progress and dynamically adjusts your plan. If you're not seeing results, we recalibrate your calories, macros, and training intensity to break through."
    },
    {
        question: "Is there an iOS or Android app?",
        answer: "Supercomp is a progressive web app (PWA) with a native mobile feel. You can add it directly to your home screen on any iOS or Android device (and even desktop!) for a full app experience without the app store download."
    },
    {
        question: "Is there a subscription fee?",
        answer: "No subscriptions. You buy tokens once and use them at your own pace. One plan generation costs one token. Simple, transparent pricing."
    }
];

function FAQItemCard({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
    return (
        <div
            className="group border-b border-border/50 last:border-b-0"
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between py-6 text-left transition-colors duration-200 hover:text-primary"
            >
                <span className="text-lg md:text-xl font-medium text-foreground group-hover:text-primary transition-colors duration-200">
                    {item.question}
                </span>
                <ChevronDown
                    className={cn(
                        "w-5 h-5 text-muted-foreground shrink-0 ml-4 transition-transform duration-300",
                        isOpen && "rotate-180 text-primary"
                    )}
                />
            </button>
            <div
                className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100 pb-6" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
                        {item.answer}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const handleToggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="relative py-24 md:py-32 bg-background overflow-hidden">
            {/* Subtle Background Gradient */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-gradient-to-b from-primary/5 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="container px-4 md:px-6 max-w-4xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6">
                        <span className="flex w-2 h-2 rounded-full bg-primary mr-2" />
                        Common Questions
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground font-editorial leading-tight">
                        Frequently Asked <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-orange-600">
                            Questions
                        </span>
                    </h2>
                </div>

                {/* FAQ Accordion */}
                <div className="bg-background/50 backdrop-blur-sm rounded-2xl border border-border/30 shadow-xl p-6 md:p-10">
                    {faqItems.map((item, index) => (
                        <FAQItemCard
                            key={index}
                            item={item}
                            isOpen={openIndex === index}
                            onToggle={() => handleToggle(index)}
                        />
                    ))}
                </div>

                {/* CTA Below FAQ */}
                <div className="mt-12 text-center">
                    <p className="text-muted-foreground text-lg mb-4">
                        Still have questions?
                    </p>
                    <a
                        href="mailto:supercomp.health@gmail.com"
                        className="inline-flex items-center gap-2 text-primary font-medium hover:underline transition-all"
                    >
                        Contact us at supercomp.health@gmail.com
                    </a>
                </div>
            </div>
        </section>
    );
}
