import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.svg';

import './Header.css';

interface HeaderProps {
    onLogin: () => void;
}

export function Header({ onLogin }: HeaderProps) {
    const [scrolled, setScrolled] = useState(false);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const showNav = !scrolled || hovered;

    return (
        <header
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => setHovered(true)}
            className={cn(
                "fixed top-6 left-0 right-0 z-50 mx-auto transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                scrolled
                    ? "liquid-header rounded-full"
                    : "bg-transparent border-transparent",
                // Adjust width based on state: compact when scrolled & not hovered, full when showing nav
                showNav ? "max-w-5xl px-8 py-4" : "max-w-[240px] px-6 py-3"
            )}
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 shrink-0">
                    <img src={logo} alt="Supercomp Logo" className="w-10 h-10 transition-transform duration-300 hover:scale-110" />
                    <span className="text-2xl font-bold tracking-tight text-foreground font-editorial">
                        Supercomp
                    </span>
                </div>

                <div className={cn(
                    "flex items-center gap-8 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    showNav ? "opacity-100 max-w-[800px] translate-x-0" : "opacity-0 max-w-0 translate-x-10"
                )}>
                    <nav className="hidden md:flex items-center gap-8 shrink-0">
                        <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors font-sans whitespace-nowrap">How it Works</a>
                        <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors font-sans whitespace-nowrap">Stories</a>
                        <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors font-sans whitespace-nowrap">Pricing</a>
                    </nav>

                    <div className="flex items-center gap-4 shrink-0">
                        <Button
                            variant="ghost"
                            onClick={onLogin}
                            className="text-sm font-medium hover:bg-primary/10 hover:text-primary font-sans whitespace-nowrap"
                        >
                            Log in
                        </Button>
                        <Button
                            onClick={onLogin}
                            className="rounded-full px-6 hover:shadow-primary/40 transition-all duration-300 font-sans whitespace-nowrap"
                        >
                            Get Started
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
