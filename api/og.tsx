import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge',
};

export default function handler(req: Request) {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#000000',
                    backgroundImage: 'radial-gradient(circle at 50% 10%, #2a1103 0%, #000000 50%)',
                    color: 'white',
                    padding: '40px',
                }}
            >
                {/* Background Glows (Simplified for OG) */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-200px',
                        left: '-200px',
                        width: '600px',
                        height: '600px',
                        background: 'rgba(249, 115, 22, 0.15)', // Orange-500
                        filter: 'blur(200px)',
                        borderRadius: '50%',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-200px',
                        right: '-200px',
                        width: '600px',
                        height: '600px',
                        background: 'rgba(249, 115, 22, 0.1)',
                        filter: 'blur(200px)',
                        borderRadius: '50%',
                    }}
                />

                {/* Content */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        zIndex: 10,
                    }}
                >
                    {/* Tagline / Badge */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 16px',
                            border: '1px solid rgba(249, 115, 22, 0.3)',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',
                            color: '#f97316',
                            fontSize: 20,
                            fontWeight: 600,
                            marginBottom: 40,
                        }}
                    >
                        AI-Powered Body Transformation
                    </div>

                    {/* Main Title */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            fontSize: 80,
                            fontWeight: 900,
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em',
                            marginBottom: 20,
                        }}
                    >
                        <span>Your Dream Physique,</span>
                        <span
                            style={{
                                backgroundImage: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                                backgroundClip: 'text',
                                color: 'transparent',
                            }}
                        >
                            Zero Guesswork.
                        </span>
                    </div>

                    {/* Subtitle */}
                    <div
                        style={{
                            fontSize: 32,
                            color: '#a1a1aa', // text-muted-foreground
                            maxWidth: 800,
                            lineHeight: 1.4,
                            marginTop: 20,
                        }}
                    >
                        Stop planning. Start transforming. The AI that builds your perfect meal plan and workout routine instantly.
                    </div>
                </div>

                {/* Brand / URL */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        fontWeight: 600,
                        color: '#71717a',
                    }}
                >
                    supercomp.ai
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    );
}
