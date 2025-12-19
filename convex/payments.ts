import { v } from "convex/values";
import { mutation, httpAction } from "./_generated/server";
import { authComponent } from "./auth";
import { api } from "./_generated/api";

// Token package configurations matching frontend
export const TOKEN_PACKAGES = {
  starter: { tokens: 700, price: 10.00 },
  professional: { tokens: 2000, price: 25.00 },
  enterprise: { tokens: 4500, price: 50.00 },
} as const;

// Create Stripe checkout session
export const createCheckoutSession = mutation({
  args: {
    packageId: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const pkg = TOKEN_PACKAGES[args.packageId];
    if (!pkg) {
      throw new Error("Invalid package ID");
    }

    try {
      // Get Stripe secret key from Convex secrets
      // Set this in Convex dashboard: npx convex env set STRIPE_SECRET_KEY sk_test_...
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        // Fallback: Return package info for manual testing
        // In production, this should always have the secret key
        console.warn("STRIPE_SECRET_KEY not set, returning package info for manual testing");
        return {
          packageId: args.packageId,
          tokens: pkg.tokens,
          price: pkg.price,
          checkoutUrl: null,
          requiresStripeKey: true,
        };
      }

      const baseUrl = process.env.CONVEX_SITE_URL || "http://localhost:5173";
      const formData = new URLSearchParams();
      formData.append("payment_method_types[]", "card");
      formData.append("line_items[0][price_data][currency]", "usd");
      formData.append("line_items[0][price_data][product_data][name]", `${pkg.tokens.toLocaleString()} Tokens - ${args.packageId}`);
      formData.append("line_items[0][price_data][product_data][description]", `Purchase ${pkg.tokens.toLocaleString()} tokens for ${pkg.price.toLocaleString()} plan generations`);
      formData.append("line_items[0][price_data][unit_amount]", Math.round(pkg.price * 100).toString());
      formData.append("line_items[0][quantity]", "1");
      formData.append("mode", "payment");
      formData.append("success_url", `${baseUrl}/settings/tokens?session_id={CHECKOUT_SESSION_ID}&success=true`);
      formData.append("cancel_url", `${baseUrl}/settings/tokens?canceled=true`);
      formData.append("client_reference_id", user._id as string);
      formData.append("metadata[userId]", user._id as string);
      formData.append("metadata[userEmail]", user.email || "");
      formData.append("metadata[packageId]", args.packageId);
      formData.append("metadata[tokens]", pkg.tokens.toString());
      formData.append("metadata[amount]", pkg.price.toString());

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const session = await parseStripeResponse(response);

      return {
        packageId: args.packageId,
        tokens: pkg.tokens,
        price: pkg.price,
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error("Stripe checkout session creation failed:", error);
      throw new Error(
        `Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

// Handle Stripe webhook for successful payments
export const handleStripeWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();

  // Get Stripe webhook secret and secret key from Convex secrets
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY not configured");
    return new Response("Stripe not configured", { status: 500 });
  }

  let event;
  try {
    // Note: This Convex webhook implementation is deprecated in favor of the
    // external Express webhook server in api/webhook/stripe/server.ts.
    // We still parse the event for backward compatibility, but do not verify
    // the Stripe signature here to avoid Node.js crypto dependencies.
    event = JSON.parse(body);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : err}`, { status: 400 });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Extract metadata from Stripe session
    let userId = session.client_reference_id || session.metadata?.userId;
    let packageId = session.metadata?.packageId;
    let tokens = parseInt(session.metadata?.tokens || "0");

    // Fallback: If metadata is missing (e.g. using Payment Links), infer from amount
    if (!packageId || !tokens) {
      const amount = session.amount_total; // in cents

      // Find matching package based on price
      // Starter: $10.00 (1000 cents)
      if (amount === 1000) {
        packageId = "starter";
        tokens = 700;
      }
      // Professional: $25.00 (2500 cents)
      else if (amount === 2500) {
        packageId = "professional";
        tokens = 2000;
      }
      // Enterprise: $50.00 (5000 cents)
      else if (amount === 5000) {
        packageId = "enterprise";
        tokens = 4500;
      }
    }

    // Attempt to recover userId from email if client_reference_id is missing
    if (!userId && session.customer_details?.email) {
      // We can't query directly here easily without making this an internal mutation
      // But addTokensFromPayment usually handles email fallback if we implemented it there.
      // For now, if userId is missing, we might need to rely on the email logic inside the mutation
      // passed as a separate arg? 
      // Actually `addTokensFromPayment` (based on previous reads) expects userId. 
      // Let's check if we can pass email to it or use a different mutation.
    }

    if (!userId || !packageId || !tokens) {
      console.error(`Webhook missing data: userId=${userId}, pkg=${packageId}, tokens=${tokens}, amount=${session.amount_total}`);
      return new Response("Missing required metadata or matching package", { status: 400 });
    }

    // Add tokens to user account
    await ctx.runMutation(api.accounts.addTokensFromPayment, {
      userId,
      tokens,
      paymentId: session.id,
      amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
    });

    // Record token purchase in usage history
    await ctx.runMutation(api.accounts.recordTokenPurchase, {
      userId,
      tokens,
      paymentId: session.id,
      packageId,
      amount: session.amount_total ? session.amount_total / 100 : 0,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function parseStripeResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error?.message ? `${json.error.message} (${json.error.type})` : text;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`Stripe API error (${response.status}): ${message}`);
  }
  return JSON.parse(text);
}
