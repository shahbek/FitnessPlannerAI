import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, RefreshCw, Info, AlertTriangle, ArrowRight, X, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import { realAIClient } from '@/ai/realAIClient';
import { Helmet } from 'react-helmet-async';
import bodyscanImage from '@/assets/images/3dicons/bodyscan.png';

// Types for analysis results
interface BodyCompositionResult {
    bodyFatPercentage: number;
    regionAnalysis: {
        core: string;
        chest: string;
        arms: string;
        legs: string;
    };
    recommendations: string[];
}

// State machine phases - Simpler now without camera
type Phase = 'intro' | 'upload' | 'analyzing' | 'results' | 'error';

export function BodyCompositionAnalyzer() {
    const [phase, setPhase] = useState<Phase>('intro');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<BodyCompositionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize AI Client on mount
    useEffect(() => {
        const initAI = async () => {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            if (apiKey) {
                try {
                    await realAIClient.initialize(
                        apiKey,
                        'https://api.groq.com/openai/v1/chat/completions',
                        'meta-llama/llama-4-scout-17b-16e-instruct' // Fallback handled in client but good to be explicit
                    );
                } catch (e) {
                    console.error("Failed to initialize AI client:", e);
                }
            } else {
                console.error("VITE_GROQ_API_KEY is missing in environment");
            }
        };
        initAI();
    }, []);

    const analyzeImage = async (base64Image: string) => {
        setIsAnalyzing(true);
        setPhase('analyzing');
        setError(null);

        try {
            const prompt = `
            Act as an elite physique coach and biometrics expert. Analyze this image to estimate body composition parameters.

            Provide the output in STRICT JSON format with NO markdown formatting, NO backticks, and NO additional text.
            
            JSON Schema:
            {
              "bodyFatPercentage": number, // Best estimate based on visible vascularity, separation, and definition
              "regionAnalysis": {
                "core": "string", // Specific observation about abs/obliques
                "chest": "string", // Specific observation about chest development
                "arms": "string", // Specific observation about biceps/triceps/shoulders
                "legs": "string" // Specific observation about quads/hamstrings/calves
              },
              "recommendations": ["string", "string"] // Exactly 2 specific, actionable bio-hacks or training tips
            }
            `;

            // Using the real AI client to call Groq Vision
            // We need to bypass the standard text-only interface for vision if possible,
            // or ensure our client supports the content array format.
            // Based on previous files, we added 'generateVisionResponse'.

            const response = await realAIClient.generateVisionResponse(prompt, base64Image);

            // Parse valid JSON from response (handling potential markdown wrappers)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in response");

            const parsedData = JSON.parse(jsonMatch[0]);

            // Validate basic structure
            if (typeof parsedData.bodyFatPercentage !== 'number') {
                throw new Error("Invalid response format");
            }

            setResult(parsedData);
            setPhase('results');

        } catch (err) {
            console.error("Analysis Failed:", err);
            setError("Could not analyze image. Please ensure the lighting is good and try again.");
            setPhase('error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setCapturedImage(base64);
                // Auto-start analysis on upload
                analyzeImage(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- RENDER PHASES ---

    const renderIntro = () => (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-4">
                    <RefreshCw className="w-3 h-3" /> AI Computer Vision 2.0
                </div>
                <h1 className="text-4xl md:text-5xl font-black font-editorial tracking-tight text-slate-900">
                    What's Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">True</span> Body Fat?
                </h1>
                <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                    Stop guessing. Our advanced AI analyzes your physique instantly to give you a professional body composition report.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                        <div className="w-48 h-48 mb-4">
                            <img src={bodyscanImage} alt="Body Scan" className="w-full h-full object-contain drop-shadow-md" />
                        </div>
                        <h3 className="font-bold text-slate-900">How to Prepare</h3>
                        <p className="text-sm text-slate-500">
                            Wear tight-fitting athletic wear or swimwear. Ensure good lighting and a plain background.
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200 h-full">
                    <CardContent className="h-full p-6 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-700">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900">Privacy First</h3>
                        <p className="text-sm text-slate-500">
                            Images are analyzed by AI and immediately discarded. No photos are stored on our servers.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-center pt-4">
                <Button
                    size="lg"
                    className="h-14 px-8 rounded-full text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                    onClick={() => setPhase('upload')}
                >
                    Start Analysis <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </div>
        </div>
    );

    const renderUpload = () => (
        <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setPhase('intro')} className="hover:text-primary pl-0">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upload Photo</span>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-[400px] border-2 border-dashed border-slate-300 rounded-3xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <p className="mb-2 text-lg font-bold text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-sm text-slate-500 max-w-[200px]">
                        SVG, PNG, JPG or WEBP (MAX. 10MB)
                    </p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
        </div>
    );

    const renderAnalyzing = () => (
        <div className="max-w-md mx-auto text-center space-y-8 py-12 animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-primary animate-pulse" />
                </div>
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Analyzing Physics...</h2>
                <p className="text-slate-500">
                    Identifying body composition markers and calculating lean mass density.
                </p>
            </div>
        </div>
    );

    const renderError = () => (
        <div className="text-center max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Analysis Failed</h2>
                <p className="text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => setPhase('upload')}>Try Again</Button>
            </div>
        </div>
    );

    const renderResults = () => {
        if (!result) return null;

        // Calculate lean mass just for display consistency if needed, though we use body fat explicitly
        const leanMassPercent = 100 - result.bodyFatPercentage;

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto w-full pb-12">
                {/* Controls */}
                <div className="flex items-center justify-between mb-6 mt-12">
                    <Button variant="ghost" onClick={() => setPhase('intro')} className="hover:text-primary pl-0">
                        <ChevronLeft className="w-4 h-4 mr-1" /> New Scan
                    </Button>
                    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Physique Report // ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    {/* Visual Evidence (Left Col) */}
                    <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
                        <div className="bg-card rounded-2xl overflow-hidden border shadow-sm relative aspect-[3/4] group">
                            {capturedImage && (
                                <img src={capturedImage} alt="Analyzed Body" className="w-full h-full object-cover grayscale-[20%] contrast-110" />
                            )}

                            {/* Overlay Metrics */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 text-white pt-20">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs font-mono opacity-70 uppercase tracking-widest mb-1">est. Body Fat</div>
                                        <div className="text-4xl font-black">{result.bodyFatPercentage}%</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-mono opacity-70 uppercase tracking-widest mb-1">est. Lean Mass</div>
                                        <div className="text-4xl font-black">{leanMassPercent}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                            <Info className="w-5 h-5 shrink-0" />
                            <p>This analysis is an AI estimate based on visual markers. Computed results may vary from DEXA scans.</p>
                        </div>
                    </div>

                    {/* Report Data (Right Col) */}
                    <div className="lg:col-span-7 space-y-8">

                        {/* Regional Breakdown Grid */}
                        <div>
                            <h3 className="font-bold font-editorial text-2xl mb-6 flex items-center gap-2">
                                <span className="w-8 h-1 bg-primary block rounded-full" />
                                Regional Analysis
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {Object.entries(result.regionAnalysis).map(([region, analysis]) => (
                                    <div key={region} className="bg-card p-5 rounded-2xl border hover:border-primary/20 transition-colors shadow-sm">
                                        <h4 className="font-mono uppercase text-xs text-muted-foreground tracking-widest mb-2">{region}</h4>
                                        <p className="text-sm leading-relaxed text-foreground/90 font-medium">
                                            {analysis}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Plan */}
                        <div>
                            <h3 className="font-bold font-editorial text-2xl mb-6 flex items-center gap-2">
                                <span className="w-8 h-1 bg-primary block rounded-full" />
                                Strategic Recommendations
                            </h3>
                            <div className="space-y-3">
                                {result.recommendations.map((rec, i) => (
                                    <div key={i} className="flex gap-4 p-4 bg-slate-50 border rounded-xl items-start">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-primary">
                                            {i + 1}
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                            {rec}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CTA Footer */}
                        <div className="pt-8 mt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-muted-foreground text-center sm:text-left">
                                <span className="block font-medium text-foreground">Ready to optimize?</span>
                                Apply these metrics to your custom plan.
                            </div>
                            <Button className="w-full sm:w-auto px-8 h-12 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
                                Generate Plan <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>

                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20 px-4 md:px-8">
            {/* SEO */}
            <Helmet>
                <title>Free AI Body Fat Test | Instant Body Composition Analysis - Supercomp</title>
                <meta name="description" content="Get an instant AI body fat test analysis using your camera. Our advanced computer vision tool estimates body composition, lean mass, and body fat percentage tailored for fitness planning." />
                <meta name="keywords" content="ai body fat test, free body fat calculator, body composition analysis ai, visual body fat estimate" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebApplication",
                        "name": "AI Body Fat Test",
                        "applicationCategory": "HealthApplication",
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "USD"
                        }
                    })}
                </script>
            </Helmet>

            <AnimatePresence mode="wait">
                {phase === 'intro' && (
                    <motion.div key="intro" exit={{ opacity: 0, y: -20 }} className="w-full">
                        {renderIntro()}
                    </motion.div>
                )}

                {phase === 'upload' && (
                    <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
                        {renderUpload()}
                    </motion.div>
                )}

                {phase === 'analyzing' && (
                    <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                        {renderAnalyzing()}
                    </motion.div>
                )}

                {phase === 'error' && (
                    <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                        {renderError()}
                    </motion.div>
                )}

                {phase === 'results' && (
                    <motion.div key="results" className="w-full">
                        {renderResults()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
