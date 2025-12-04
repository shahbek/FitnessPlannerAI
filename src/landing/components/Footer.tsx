
import React from 'react';
import { Github, Twitter, Instagram } from 'lucide-react';
import logo from '@/assets/logo.svg';

export function Footer() {
    return (
        <footer className="bg-white/50 backdrop-blur-md border-t border-white/20 py-12 font-sans">
            <div className="container px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <img src={logo} alt="Supercomp Logo" className="w-6 h-6" />
                            <span className="text-xl font-bold tracking-tight font-editorial">Supercomp</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            The next generation of AI-powered fitness planning. Built for athletes, by athletes.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4 font-editorial">Product</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary">Features</a></li>
                            <li><a href="#" className="hover:text-primary">Pricing</a></li>
                            <li><a href="#" className="hover:text-primary">Testimonials</a></li>
                            <li><a href="#" className="hover:text-primary">FAQ</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4 font-editorial">Company</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary">About</a></li>
                            <li><a href="#" className="hover:text-primary">Blog</a></li>
                            <li><a href="#" className="hover:text-primary">Careers</a></li>
                            <li><a href="#" className="hover:text-primary">Contact</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4 font-editorial">Legal</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-primary">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-black/5">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Supercomp. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                            <Twitter className="w-5 h-5" />
                        </a>
                        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                            <Instagram className="w-5 h-5" />
                        </a>
                        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

