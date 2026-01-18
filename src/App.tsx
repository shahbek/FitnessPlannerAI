
import { FitnessLayout } from '@/components/layout/FitnessLayout';
import { AuthPage } from '@/pages/AuthPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useEffect, lazy, Suspense, useState } from 'react';
import Lottie from "lottie-react";
import logoAnimation from "@/assets/lottieanimations/LogoLoading.json";

import { useAuthWithCache } from './hooks/useAuthWithCache';

// Lazy load LiquidGlassCursor to avoid SSR issues and reduce initial bundle
const LiquidGlassCursor = lazy(() =>
  import('@/components/LiquidGlassCursor').then(module => ({ default: module.LiquidGlassCursor }))
);

// Lazy load LandingPage
const LandingPage = lazy(() =>
  import('@/landing/LandingPage').then(module => ({ default: module.LandingPage }))
);

// Lazy load BodyCompositionPage
const BodyCompositionPage = lazy(() =>
  import('@/landing/free-tools/BodyCompositionPage').then(module => ({ default: module.BodyCompositionPage }))
);

export default function App() {
  // Use our new cached auth hook
  // This will return the cached user immediately if available
  const { user: currentUser, isLoading, isFresh } = useAuthWithCache();

  // State to track if we should show the landing page
  const [showLanding, setShowLanding] = useState(true);

  // Authenticated: we have a user
  const isAuthenticated = currentUser !== null && currentUser !== undefined;

  // Debug logging
  useEffect(() => {
    console.log('🔐 Better Auth state (Cached):', {
      isLoading,
      isAuthenticated,
      hasUser: !!currentUser,
      userId: currentUser?._id,
    });
  }, [isLoading, isAuthenticated, currentUser]);

  // Show loading spinner (not auth page) while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-4">
            <Lottie animationData={logoAnimation} loop={true} />
          </div>
          <p className="text-lg font-medium text-muted-foreground">Loading your fitness dashboard...</p>
        </div>
      </div>
    );
  }



  // Only show auth page when we're certain user is not authenticated
  return (
    <>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <LiquidGlassCursor />
        </Suspense>
      </ErrorBoundary>
      {isAuthenticated ? (
        <FitnessLayout isAuthFresh={isFresh} />
      ) : window.location.pathname === '/free-tools/ai-body-fat-test' ? (
        <Suspense fallback={null}>
          <BodyCompositionPage onLogin={() => setShowLanding(false)} />
        </Suspense>
      ) : showLanding ? (
        <Suspense fallback={null}>
          <LandingPage onLogin={() => setShowLanding(false)} />
        </Suspense>
      ) : (
        <AuthPage />
      )}
    </>
  );
}
