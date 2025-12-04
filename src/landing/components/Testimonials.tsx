import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
    {
        name: "Sarah J.",
        role: "Marathon Runner",
        content: "The adaptive training plan is a game changer. It adjusted my volume when I was feeling fatigued, preventing injury.",
        rating: 5
    },
    {
        name: "Mike T.",
        role: "Powerlifter",
        content: "Finally, an app that understands periodization. My bench press increased by 20lbs in just 8 weeks.",
        rating: 5
    },
    {
        name: "Elena R.",
        role: "Yoga Instructor",
        content: "I love how it balances strength training with my yoga practice. The meal plans are actually delicious too!",
        rating: 5
    }
];

export function Testimonials() {
    return (
        <section id="testimonials" className="py-24 bg-secondary/30 relative">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-editorial">
                        Trusted by Athletes
                    </h2>
                    <p className="text-lg text-muted-foreground font-sans">
                        Join thousands of users who have transformed their fitness journey.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="p-8 rounded-3xl bg-white/60 backdrop-blur-md border border-white/40 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <div className="flex gap-1 mb-4">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                                ))}
                            </div>

                            <p className="text-lg mb-6 leading-relaxed font-sans italic">
                                "{testimonial.content}"
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-300 flex items-center justify-center text-white font-bold font-sans">
                                    {testimonial.name[0]}
                                </div>
                                <div>
                                    <p className="font-bold font-sans">{testimonial.name}</p>
                                    <p className="text-sm text-muted-foreground font-sans">{testimonial.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
