import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// IMPORTANT:
// Use the app's own domain for auth in ALL environments.
// - Dev: Vite proxies /api/auth -> Convex
// - Prod: Vercel rewrites /api/auth -> Convex
//
// This guarantees OAuth callbacks use `https://www.supercomp.app/api/auth/callback/google`
// and avoids mixing Convex domains in the browser.
const baseURL =
  typeof window !== "undefined" ? window.location.origin : "https://www.supercomp.app";

console.log("🔐 Auth client baseURL:", baseURL);

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

