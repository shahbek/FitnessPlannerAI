import ReactDOM from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './lib/auth-client';
import App from './App';
import { Toaster } from './components/ui/toaster';
import './index.css';

import { convex } from './lib/convex';

// Client initialized in lib/convex.ts
console.log('🔗 Convex client initialized');

console.log('🔗 Convex client initialized with URL:', import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConvexBetterAuthProvider client={convex} authClient={authClient}>
    <App />
    <Toaster />
  </ConvexBetterAuthProvider>
);
