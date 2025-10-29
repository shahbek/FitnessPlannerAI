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
    // Configure email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // Enable password reset
      sendResetPassword: async ({ user, url }) => {
        console.log(`Password reset for ${user.email}: ${url}`);
        // In production, send email here
        // For development, we'll just log it
      },
    },
    // Configure social auth providers
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        enabled: !!process.env.GOOGLE_CLIENT_ID,
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
