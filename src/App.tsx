
import { FitnessLayout } from '@/components/layout/FitnessLayout';
import { AuthPage } from '@/pages/AuthPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useEffect, lazy, Suspense, useState } from 'react';
import Lottie from "lottie-react";
import logoAnimation from "@/assets/lottieanimations/LogoLoading.json";

// Lazy load LiquidGlassCursor to avoid SSR issues and reduce initial bundle
const LiquidGlassCursor = lazy(() =>
  import('@/components/LiquidGlassCursor').then(module => ({ default: module.LiquidGlassCursor }))
);

// Lazy load LandingPage
const LandingPage = lazy(() =>
  import('@/landing/LandingPage').then(module => ({ default: module.LandingPage }))
);

export default function App() {
  // Fetch current user from Convex (Better Auth is handled internally)
  const currentUser = useQuery(api.users.getCurrentUser);

  // State to track if we should show the landing page
  const [showLanding, setShowLanding] = useState(true);

  // Loading state
  const isLoading = currentUser === undefined;

  // Authenticated: we have a user
  const isAuthenticated = currentUser !== null && currentUser !== undefined;

  // Debug logging
  useEffect(() => {
    console.log('🔐 Better Auth state:', {
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
        <FitnessLayout />
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
