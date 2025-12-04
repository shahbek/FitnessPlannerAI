import React from 'react';

const steps = [
    {
        icon: "/assets/images/3dIcons/pullup.png",
        title: "Tell Us Your Goals",
        description: "Share your fitness objectives, current stats, and preferences. Our AI analyzes your profile to create the perfect strategy."
    },
    {
        icon: "/assets/images/3dIcons/calendar.png",
        title: "Get Your Custom Plan",
        description: "Receive a comprehensive workout and meal plan tailored specifically to your body type and schedule."
    },
    {
        icon: "/assets/images/3dIcons/track.png",
        title: "Track & Eat Smart",
        description: "Follow daily macro targets and meal suggestions that adapt to your progress and preferences."
    },
    {
        icon: "/assets/images/3dIcons/target.png",
        title: "Evolve With AI",
        description: "As you log workouts and check-ins, our AI adjusts your plan in real-time to ensure continuous progress."
    }
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 relative overflow-hidden">
            <div className="container px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-editorial">
                        Science-Based Planning, <br />
                        <span className="text-primary">Simplified</span>
                    </h2>
                    <p className="text-lg text-muted-foreground font-sans">
                        Stop guessing. Let our advanced AI algorithms build the most effective path to your dream physique.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="group relative p-6 rounded-3xl bg-white/50 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <div className="w-20 h-20 mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <img
                                        src={step.icon}
                                        alt={step.title}
                                        className="w-full h-full object-contain drop-shadow-xl"
                                    />
                                </div>

                                <h3 className="text-xl font-bold mb-3 font-editorial">{step.title}</h3>
                                <p className="text-muted-foreground leading-relaxed font-sans">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
