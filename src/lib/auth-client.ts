import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Determine the auth base URL based on environment
// - Development: Use localhost (proxied by Vite to Convex)
// - Production: Use Convex directly (no proxy needed)
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const baseURL = isLocalhost 
  ? window.location.origin  // Dev: localhost:3000, proxied by Vite
  : 'https://clean-swordfish-102.convex.cloud'; // Prod: Direct to Convex

console.log('🔐 Auth client baseURL:', baseURL, isLocalhost ? '(dev mode)' : '(prod mode)');

export const authClient = createAuthClient({
  baseURL,
  plugins: [convexClient()],
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  forgetPassword,
  resetPassword,
  updateUser,
} = authClient;

