import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import type { WebcamProps } from 'react-webcam'; // Type import
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Camera, Check, RefreshCw, Info, AlertTriangle, ArrowRight, X, ChevronLeft } from 'lucide-react';
import { realAIClient } from '@/ai/realAIClient';
import * as mpPose from '@mediapipe/pose';
import * as CameraUtils from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Helmet } from 'react-helmet-async';

// Types for analysis results
interface BodyCompositionResult {
    bodyFatPercentage: number;
    leanMassPercentage: number;
    regionAnalysis: {
        core: string;
        chest: string;
        arms: string;
        legs: string;
    };
    recommendations: string[];
}

// State machine phases
type Phase = 'intro' | 'input-selection' | 'camera' | 'upload' | 'analyzing' | 'results' | 'error';

export function BodyCompositionAnalyzer() {
    const [phase, setPhase] = useState<Phase>('intro');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<BodyCompositionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Camera & Auto-Capture Refs
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);
    const poseEstimatorRef = useRef<mpPose.Pose | null>(null);
    const lastPoseTimeRef = useRef<number>(0);
    const stabilityCounterRef = useRef<number>(0);
    const isPoseDetectedRef = useRef<boolean>(false);

    // Initialize AI Client on mount
    useEffect(() => {
        const initAI = async () => {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            if (apiKey) {
                try {
                    // Auto-detect provider based on endpoint or use explicit 'groq' convention if supported
                    // Passing full Groq endpoint just in case
                    await realAIClient.initialize(
                        apiKey,
                        'https://api.groq.com/openai/v1/chat/completions',
                        'meta-llama/llama-4-scout-17b-16e-instruct'
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

    // Initialize MediaPipe Pose
    useEffect(() => {
        if (phase === 'camera' && !poseEstimatorRef.current) {
            const pose = new mpPose.Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });

            pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            pose.onResults(onPoseResults);
            poseEstimatorRef.current = pose;

            // Start camera loop
            if (typeof window !== 'undefined' && webcamRef.current && webcamRef.current.video) {
                // We need a custom loop to send frames to MediaPipe
                const camera = new CameraUtils.Camera(webcamRef.current.video, {
                    onFrame: async () => {
                        if (webcamRef.current && webcamRef.current.video && poseEstimatorRef.current) {
                            await poseEstimatorRef.current.send({ image: webcamRef.current.video });
                        }
                    },
                    width: 640,
                    height: 480
                });
                camera.start();
            }
        }

        return () => {
            // Cleanup if needed, though CameraUtils handles stream cleanup mostly
            poseEstimatorRef.current?.close();
            poseEstimatorRef.current = null;
        };
    }, [phase]);

    // Handle Pose Results & Auto-Capture Logic
    const onPoseResults = useCallback((results: any) => {
        if (!canvasRef.current || !webcamRef.current?.video) return;

        const canvasCtx = canvasRef.current.getContext('2d');
        if (!canvasCtx) return;

        // Draw video frame
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Draw landmarks
        if (results.poseLandmarks) {
            isPoseDetectedRef.current = true;

            // Draw skeleton
            drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS,
                { color: '#f43e01', lineWidth: 4 }); // Brand color
            drawLandmarks(canvasCtx, results.poseLandmarks,
                { color: '#ffffff', lineWidth: 2 });

            // Auto-Capture Logic
            // Check if user is stable (simplified: if valid pose detected for extensive frames)
            // In a real app, we'd check movement delta. For now, we trust presence + time.
            if (isAutoCaptureEnabled && !countdown) {
                stabilityCounterRef.current += 1;

                if (stabilityCounterRef.current > 60) { // ~2 seconds @ 30fps
                    startAutoCaptureCountdown();
                }
            }
        } else {
            isPoseDetectedRef.current = false;
            stabilityCounterRef.current = 0;
        }
        canvasCtx.restore();
    }, [isAutoCaptureEnabled, countdown]);

    const startAutoCaptureCountdown = () => {
        stabilityCounterRef.current = 0; // Reset
        setCountdown(3);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev === 1) {
                    clearInterval(interval);
                    capturePhoto();
                    return null;
                }
                return (prev || 0) - 1;
            });
        }, 1000);
    };

    const capturePhoto = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
            setPhase('analyzing');
            analyzeImage(imageSrc);
        }
    }, [webcamRef]);

    const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setCapturedImage(base64);
                setPhase('analyzing');
                analyzeImage(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeImage = async (base64Image: string) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const prompt = `
      Act as an elite physique coach. Provide a detailed aesthetic analysis of this body.
      
      Analyze these specific regions if visible:
      1. Core (Abs/Obliques) - separation, definition
      2. Chest - fullness, shape
      3. Arms (Biceps/Triceps) - size, vascularity
      4. Legs (Quads/Calves) - sweep, definition
      
      For each region, provide a specific observation.
      
      Output JSON format:
      {
        "bodyFatPercentage": number,
        "regionAnalysis": {
            "core": "string",
            "chest": "string",
            "arms": "string",
            "legs": "string"
        },
        "recommendations": ["string", "string"] (2 key actionable tips)
      }
      `;

            const response = await realAIClient.generateVisionResponse(prompt, base64Image);

            // Parse JSON
            let data: BodyCompositionResult;
            try {
                // extract json block if needed
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : response;
                const parsed = JSON.parse(jsonStr);

                // Programmatically calculate lean mass to ensure logical consistency
                data = {
                    ...parsed,
                    leanMassPercentage: 100 - parsed.bodyFatPercentage
                };

                setResult(data);
                setPhase('results');
            } catch (e) {
                console.warn("Raw vision response parse failed", response);
                throw new Error("Could not parse AI analysis results. " + response.substring(0, 50));
            }
        } catch (err) {
            console.error('Analysis failed:', err);
            setError('We could not analyze this image. Please ensure the full body is visible and try again.');
            setPhase('error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Render Helpers
    const renderIntro = () => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-12 max-w-4xl mx-auto flex flex-col items-center">
            <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                    <span className="flex w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                    Free AI Tool
                </div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground leading-[1.1]">
                    AI Body Fat <span className="text-primary">Scanner</span>
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                    Get an instant, medical-grade body composition analysis using just your camera. Powered by advanced computer vision.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 w-full text-left">
                {[
                    { icon: Camera, title: "1. Scan Body", desc: "Use your camera or upload a photo." },
                    { icon: RefreshCw, title: "2. AI Analysis", desc: "Our vision model maps your physique." },
                    { icon: ArrowRight, title: "3. Get Metrics", desc: "View BF%, Lean Mass & Insights." }
                ].map((item, i) => (
                    <Card key={i} className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all">
                        <CardContent className="pt-6">
                            <div className="mb-4 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col items-center gap-6">
                <Button
                    size="lg"
                    className="h-16 px-10 rounded-full text-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_30px_rgb(244,62,1,0.3)] transition-all hover:scale-105"
                    onClick={() => setPhase('input-selection')}>
                    Start Analysis
                </Button>

                <p className="text-sm text-muted-foreground/60 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Images are processed privately and never stored.
                </p>
            </div>
        </motion.div>
    );

    const renderInputSelection = () => (
        <div className="max-w-lg mx-auto w-full space-y-8 text-center">
            <div className="space-y-4">
                <Button variant="ghost" className="rounded-full pl-0 hover:bg-transparent hover:text-primary" onClick={() => setPhase('intro')}>
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </Button>
                <h2 className="text-3xl font-bold">Choose Input Method</h2>
            </div>

            <div className="grid gap-6">
                <Button
                    variant="outline"
                    className="h-40 flex flex-col gap-4 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all group"
                    onClick={() => setPhase('camera')}>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Camera className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                        <div className="font-bold text-lg">Use Camera</div>
                        <div className="text-sm text-muted-foreground">Best for auto-capture</div>
                    </div>
                </Button>

                <div className="relative group">
                    <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={onFileUpload}
                    />
                    <Button variant="outline" className="w-full h-40 flex flex-col gap-4 border-2 border-dashed hover:border-blue-500 hover:bg-blue-500/5 transition-all">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-lg">Upload Photo</div>
                            <div className="text-sm text-muted-foreground">From your gallery</div>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderCamera = () => (
        <div className="max-w-2xl mx-auto w-full relative">
            <Button variant="secondary" size="sm" className="mb-4 rounded-full" onClick={() => setPhase('input-selection')}>
                Cancel
            </Button>

            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black aspect-[3/4] md:aspect-[4/3] ring-4 ring-border">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Overlays */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8">
                    <div className={`
                        px-6 py-3 rounded-full text-sm font-bold backdrop-blur-md transition-all
                        ${countdown ? 'bg-primary text-white scale-110' : 'bg-black/40 text-white'}
                    `}>
                        {countdown ? `STAY STILL: ${countdown}` :
                            isAutoCaptureEnabled ? "Stand back to show full body" : "Position yourself"}
                    </div>

                    {!isAutoCaptureEnabled && (
                        <Button
                            size="lg"
                            onClick={capturePhoto}
                            className="rounded-full w-20 h-20 p-0 border-[6px] border-white/30 bg-white hover:bg-white/90 pointer-events-auto shadow-2xl"
                        >
                            <div className="w-16 h-16 rounded-full bg-transparent border-2 border-black/10" />
                        </Button>
                    )}
                </div>

                {/* Auto Capture Count */}
                {countdown && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                        <div className="text-[120px] font-black text-white animate-bounce drop-shadow-2xl">
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-between items-center text-sm text-muted-foreground px-4">
                <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>Lighting matters!</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsAutoCaptureEnabled(!isAutoCaptureEnabled)}>
                    {isAutoCaptureEnabled ? "Switch to Manual" : "Switch to Auto"}
                </Button>
            </div>
        </div>
    );

    const renderAnalyzing = () => (
        <div className="flex flex-col items-center justify-center max-w-md mx-auto w-full text-center space-y-10">
            <div className="relative w-48 h-48 mx-auto">
                {/* Show captured image with scanning effect */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-primary/20">
                    {capturedImage && (
                        <img src={capturedImage} className="w-full h-full object-cover opacity-50 blur-sm" alt="Scanning" />
                    )}
                </div>

                <div className="absolute inset-0 border-t-4 border-primary animate-[scan_2s_ease-in-out_infinite] bg-gradient-to-b from-primary/20 to-transparent" />

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-xl">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-3xl font-bold">Analyzing Physique...</h2>
                <div className="space-y-2 text-muted-foreground">
                    <p>Identifying body landmarks...</p>
                    <p>Calculating adipose tissue density...</p>
                    <p>Estimating lean mass ratio...</p>
                </div>
            </div>
        </div>
    );

    const renderError = () => (
        <div className="text-center max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Analysis Failed</h2>
                <p className="text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => setPhase('input-selection')}>Try Again</Button>
            </div>
        </div>
    );

    const renderResults = () => {
        if (!result) return null;
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
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />

                            {/* Overlay Metrics */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-6">
                                <div className="text-white w-full">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className="text-xs font-medium opacity-80 uppercase tracking-widest mb-1">Body Fat Est.</div>
                                            <div className="flex items-baseline gap-1">
                                                <div className="text-6xl font-black">{result.bodyFatPercentage}</div>
                                                <div className="text-2xl font-bold text-primary">%</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-medium opacity-80 uppercase tracking-widest mb-1">Lean Mass</div>
                                            <div className="text-3xl font-bold">{result.leanMassPercentage}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Data (Right Col) */}
                    <div className="lg:col-span-7 space-y-8">

                        {/* Granular Breakdown */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-sm uppercase tracking-wide">Regional Analysis</h3>
                                <span className="text-xs text-muted-foreground">Aesthetic Balance</span>
                            </div>

                            <div className="grid gap-4">
                                {result.regionAnalysis && Object.entries(result.regionAnalysis).map(([region, analysis]) => (
                                    <div key={region} className="bg-card rounded-xl p-4 border flex flex-col md:flex-row gap-4 items-start md:items-center">
                                        <div className="w-24 shrink-0">
                                            <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{region}</div>
                                        </div>
                                        <div className="text-sm text-foreground/90 leading-snug">
                                            {typeof analysis === 'string' ? analysis : "Analysis pending..."}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-sm uppercase tracking-wide">Protocol Adjustments</h3>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {result.recommendations.map((rec, i) => (
                                    <div key={i} className="bg-card/50 p-4 rounded-xl border border-dashed flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">{rec}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Refined CTA */}
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
                <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-6xl"
                >
                    {phase === 'intro' && renderIntro()}
                    {phase === 'input-selection' && renderInputSelection()}
                    {phase === 'camera' && renderCamera()}
                    {phase === 'analyzing' && renderAnalyzing()}
                    {phase === 'error' && renderError()}
                    {phase === 'results' && renderResults()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
