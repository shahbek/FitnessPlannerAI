import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
    onCapture: (imageBase64: string) => void;
    onCancel: () => void;
    mode?: 'label' | 'meal'; // Add mode to customize UI text
}

export function CameraCapture({ onCapture, onCancel, mode = 'label' }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [isCameraReady, setIsCameraReady] = useState(false);

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
                        setError('Camera access denied. Please grant camera permissions or use gallery upload.');
                    } else if (err.name === 'NotFoundError') {
                        setError('No camera found. Please use gallery upload instead.');
                    } else {
                        setError('Failed to access camera. Please try gallery upload.');
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

        onCapture(imageBase64);
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-4 rounded-full bg-rose-100">
                    <Camera className="h-8 w-8 text-rose-600" />
                </div>
                <div className="text-center">
                    <h3 className="font-semibold text-slate-800 mb-2">Camera Unavailable</h3>
                    <p className="text-sm text-slate-600 mb-4">{error}</p>
                </div>
                <Button onClick={onCancel} variant="outline" className="rounded-xl">
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden">
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
                            <Camera className="h-12 w-12 mx-auto mb-3 animate-pulse" />
                            <p className="text-sm">Initializing camera...</p>
                        </div>
                    </div>
                )}

                {/* Camera overlay guide */}
                {isCameraReady && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-lg aspect-square relative">
                                {/* Corner indicators only - no border */}
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
                            </div>
                        </div>
                        <div className="absolute top-4 left-0 right-0 text-center">
                            <p className="text-white text-sm font-semibold bg-slate-900/80 backdrop-blur-sm inline-block px-4 py-2 rounded-xl">
                                {mode === 'meal'
                                    ? 'Position your meal within frame'
                                    : 'Position nutrition label within frame'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-3 mt-4">
                <Button
                    onClick={onCancel}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                </Button>
                <Button
                    onClick={capturePhoto}
                    disabled={!isCameraReady}
                    className={cn(
                        "flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all",
                        "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                        "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                        "hover:shadow-[0_6px_16px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    )}
                >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                </Button>
            </div>
        </div>
    );
}
