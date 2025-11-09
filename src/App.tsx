import { FitnessLayout } from '@/components/layout/FitnessLayout';
import { AuthPage } from '@/pages/AuthPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useEffect, lazy, Suspense } from 'react';

// Lazy load LiquidGlassCursor to avoid SSR issues and reduce initial bundle
const LiquidGlassCursor = lazy(() => 
  import('@/components/LiquidGlassCursor').then(module => ({ default: module.LiquidGlassCursor }))
);

export default function App() {
  // Fetch current user from Convex (Better Auth is handled internally)
  const currentUser = useQuery(api.users.getCurrentUser);
  
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Loading your fitness dashboard...</p>
        </div>
      </div>
    );
  }

  // Only show auth page when we're certain user is not authenticated
  return (
    <>
      {isAuthenticated && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <LiquidGlassCursor />
          </Suspense>
        </ErrorBoundary>
      )}
      {isAuthenticated ? <FitnessLayout /> : <AuthPage />}
    </>
  );
}
