import ReactDOM from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './lib/auth-client';
import App from './App';
import { Toaster } from './components/ui/toaster';
import './index.css';

// Verify Convex URL is set
if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error('VITE_CONVEX_URL environment variable is not set');
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

console.log('🔗 Convex client initialized with URL:', import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConvexBetterAuthProvider client={convex} authClient={authClient}>
    <App />
    <Toaster />
  </ConvexBetterAuthProvider>
);
