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

      // Dynamically import Stripe to avoid bundling issues
      const stripeModule = await import("stripe");
      const Stripe = stripeModule.default;
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2025-10-29.clover",
      });

      // Get base URL from environment or use default
      // In production, set CONVEX_SITE_URL in Convex dashboard
      const baseUrl = process.env.CONVEX_SITE_URL || "http://localhost:5173";

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${pkg.tokens.toLocaleString()} Tokens - ${args.packageId}`,
                description: `Purchase ${pkg.tokens.toLocaleString()} tokens for ${pkg.price.toLocaleString()} plan generations`,
              },
              unit_amount: Math.round(pkg.price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}/settings/tokens?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}/settings/tokens?canceled=true`,
        client_reference_id: user._id as string,
        metadata: {
          userId: user._id as string,
          userEmail: user.email || "",
          packageId: args.packageId,
          tokens: pkg.tokens.toString(),
          amount: pkg.price.toString(),
        },
      });

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
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await request.text();
  
  // Get Stripe webhook secret and secret key from Convex secrets
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY not configured");
    return new Response("Stripe not configured", { status: 500 });
  }

  let event;
  try {
    // Dynamically import Stripe
    const stripeModule = await import("stripe");
    const Stripe = stripeModule.default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-10-29.clover",
    });

    // Verify webhook signature in production
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Development mode: parse directly (NOT SECURE for production)
      console.warn("STRIPE_WEBHOOK_SECRET not set, skipping signature verification (DEVELOPMENT ONLY)");
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err}`, { status: 400 });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    
    // Extract metadata from Stripe session
    const userId = session.client_reference_id || session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    const tokens = parseInt(session.metadata?.tokens || "0");
    
    if (!userId || !packageId || !tokens) {
      return new Response("Missing required metadata", { status: 400 });
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

