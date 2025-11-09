import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Use localhost which will be proxied to Convex by Vite
// This avoids CORS issues in development
const baseURL = window.location.origin; // http://localhost:3000

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
} = authClient;

