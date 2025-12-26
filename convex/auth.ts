import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  return betterAuth({
    // disable logging when createAuth is called just to generate options
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://*.ngrok-free.app", // Allow all ngrok subdomains
      "https://supercomp.app",
      "https://www.supercomp.app",
      "https://fitness-planner-ai.vercel.app",
      "https://fitness-planner-*-shahbeks-projects.vercel.app", // Allow Vercel Preview deployments
      siteUrl,
    ],
    // Configure email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // Enable password reset
      sendResetPassword: async ({ user, url }) => {
        // TODO: Integrate with an email provider like Resend
        // if (process.env.RESEND_API_KEY) { ... }

        console.log(`\n=== PASSWORD RESET ===\nTo reset password for ${user.email}, click here:\n${url}\n======================\n`);
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        // Explicitly set redirectURI to ensure it matches Google Cloud Console exactly
        redirectURI: `${siteUrl}/api/auth/callback/google`,
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex(),
    ],
  });
};

// Get current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
