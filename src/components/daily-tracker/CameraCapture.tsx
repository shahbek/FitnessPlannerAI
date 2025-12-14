import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
    onCapture: (imageBase64: string, mode: 'label' | 'meal') => void;
    onCancel: () => void;
    initialMode?: 'label' | 'meal';
}

export function CameraCapture({ onCapture, onCancel, initialMode = 'label' }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [mode, setMode] = useState<'label' | 'meal'>(initialMode);

    useEffect(() => {
        let mounted = true;

        const initCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment', // Use back camera on mobile
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                });

                if (!mounted) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    return;
                }

                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.onloadedmetadata = () => {
                        setIsCameraReady(true);
                    };
                }
            } catch (err) {
                console.error('Camera access error:', err);
                if (err instanceof Error) {
                    if (err.name === 'NotAllowedError') {
                        setError('Camera access denied. Please grant camera permissions.');
                    } else if (err.name === 'NotFoundError') {
                        setError('No camera found on this device.');
                    } else {
                        setError('Failed to access camera. Please try again.');
                    }
                }
            }
        };

        initCamera();

        return () => {
            mounted = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);

        // Stop camera stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        onCapture(imageBase64, mode);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Stop camera before returning
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            onCapture(base64String, mode);
        };
        reader.readAsDataURL(file);
    };

    if (typeof document === 'undefined') return null;

    if (error) {
        return createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8">
                <div className="p-4 rounded-full bg-rose-100 mb-4">
                    <Camera className="h-12 w-12 text-rose-600" />
                </div>
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Camera Unavailable</h3>
                    <p className="text-sm text-slate-300">{error}</p>
                </div>
                <Button
                    onClick={onCancel}
                    variant="outline"
                    className="rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                    Go Back
                </Button>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col pointer-events-auto">
            {/* Header with Segmented Control */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-6 md:pt-6">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        onClick={onCancel}
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/10 rounded-full bg-black/20 backdrop-blur-md border border-white/5"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Segmented Control */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <div className="inline-flex p-1 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 shadow-lg">
                        <button
                            onClick={() => setMode('label')}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                                mode === 'label'
                                    ? "bg-white text-black shadow-md"
                                    : "text-white/80 hover:text-white hover:bg-white/10"
                            )}
                        >
                            Nutrition Label
                        </button>
                        <button
                            onClick={() => setMode('meal')}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                                mode === 'meal'
                                    ? "bg-white text-black shadow-md"
                                    : "text-white/80 hover:text-white hover:bg-white/10"
                            )}
                        >
                            Meal Photo
                        </button>
                    </div>
                </div>
            </div>

            {/* Camera Feed */}
            <div className="relative flex-1 bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                        "w-full h-full object-cover",
                        !isCameraReady && "opacity-0"
                    )}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!isCameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                            <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-emerald-500" />
                            <p className="text-lg font-medium">Initializing camera...</p>
                        </div>
                    </div>
                )}

                {/* Camera Frame Guide */}
                {isCameraReady && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <div className="w-full max-w-lg aspect-square relative border border-white/20 rounded-3xl overflow-hidden box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                {/* Corner indicators */}
                                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-3xl opacity-80" />
                                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-3xl opacity-80" />
                                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-3xl opacity-80" />
                                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white rounded-br-3xl opacity-80" />

                                {/* Center crosshair (subtle) */}
                                <div className="absolute top-1/2 left-1/2 w-8 h-0.5 bg-white/30 -translate-x-1/2 -translate-y-1/2" />
                                <div className="absolute top-1/2 left-1/2 w-0.5 h-8 bg-white/30 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Instruction Text */}
                        <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none">
                            <p className="text-white text-base font-semibold bg-black/60 backdrop-blur-md inline-block px-6 py-3 rounded-full shadow-lg border border-white/10">
                                {mode === 'meal'
                                    ? 'Position meal within frame'
                                    : 'Center nutrition label'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-8 py-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <div className="flex items-center justify-between max-w-sm mx-auto">
                    {/* Gallery Upload Button */}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95 group"
                    >
                        <ImageIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                    </button>

                    {/* Large Circular Shutter Button */}
                    <button
                        onClick={capturePhoto}
                        disabled={!isCameraReady}
                        className={cn(
                            "w-18 h-18 sm:w-20 sm:h-20 rounded-full border-[5px] border-white bg-white/20 backdrop-blur-sm",
                            "transition-all duration-200 transform",
                            "active:scale-95 active:bg-white/40",
                            isCameraReady
                                ? "hover:bg-white/30 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                                : "opacity-50 cursor-not-allowed border-white/50"
                        )}
                        aria-label="Capture photo"
                    >
                        <div className={cn(
                            "w-full h-full rounded-full bg-white transition-all duration-200",
                            "scale-90 active:scale-75"
                        )} />
                    </button>

                    {/* Spacer to balance layout */}
                    <div className="w-14" />
                </div>
            </div>
        </div>,
        document.body
    );
}
