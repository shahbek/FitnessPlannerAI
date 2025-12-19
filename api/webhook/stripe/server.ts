import 'dotenv/config';
import express from "express";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

// Initialize Stripe with your secret key
const stripeSecretKey = process.env.VITE_STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("VITE_STRIPE_SECRET_KEY is not set in environment");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover" as any, // Cast to any to avoid TS errors with beta/preview versions if definitions drift
});

// Webhook signing secret from environment
const endpointSecret = process.env.VITE_STRIPE_WEBHOOK_SECRET;
if (!endpointSecret) {
  throw new Error("VITE_STRIPE_WEBHOOK_SECRET is not set in environment");
}

// Convex HTTP client to credit tokens after successful payment
const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set in environment");
}

const convex = new ConvexHttpClient(convexUrl);

// Map payment links to token packages
// For now we only know the starter plan link from the prompt.
// Add additional entries here as you create more payment links.
const PAYMENT_LINK_PACKAGES: Record<
  string,
  { packageId: "starter" | "professional" | "enterprise"; tokens: number }
> = {
  // Example: replace "plink_xxx" with your real Payment Link ID
  // You can find this ID on the Payment Link details page in Stripe.
  // "plink_xxx": { packageId: "starter", tokens: 700 },
};

const app = express();

// Stripe requires the raw body for webhook verification
app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];

    if (!sig || Array.isArray(sig)) {
      response.status(400).send("Missing Stripe signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Stripe webhook signature verification failed:", message);
      response.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          const email =
            session.customer_details?.email || session.customer_email || null;
          const paymentLinkId =
            typeof session.payment_link === "string"
              ? session.payment_link
              : null;

          console.log(`Checkout session completed:`, {
            sessionId: session.id,
            email,
            customerId: session.customer,
            amountTotal: session.amount_total,
            paymentStatus: session.payment_status,
          });


          // Extract User ID (client_reference_id)
          const userId = session.client_reference_id;

          if (!userId && !email) {
            console.warn(
              "checkout.session.completed without customer email OR client_reference_id; skipping token credit"
            );
            break;
          }

          // For now we only support the Starter plan via a single Payment Link.
          // Any successful checkout will credit 700 tokens as the "starter" package.
          const packageId: "starter" = "starter";
          const tokens = 700;

          // Get the amount from the session (in cents, convert to dollars)
          const amount = session.amount_total ? session.amount_total / 100 : 10.00;

          console.log(`Processing payment for userId: ${userId}, email: ${email}, tokens: ${tokens}, amount: ${amount}`);

          try {
            if (userId) {
              // Prioritize crediting by User ID (safest)
              await convex.mutation(api.accounts.addTokensFromPayment, {
                userId,
                tokens,
                paymentId: session.id,
                amount,
              });
              console.log(
                `Credited ${tokens} tokens to UserId ${userId} for package ${packageId}`
              );
            } else if (email) {
              // Fallback to email if no User ID usually shouldn't happen with our checkout flow
              await convex.mutation(api.accounts.addTokensFromPaymentByEmail, {
                email,
                tokens,
                paymentId: session.id,
                amount,
                packageId,
              });
              console.log(
                `Credited ${tokens} tokens to email ${email} for package ${packageId}`
              );
            }
          } catch (error) {
            console.error(`Failed to credit tokens:`, error);
            throw error; // Re-throw to trigger 500 response
          }

          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      response.json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error handling Stripe webhook event:", message);
      response.status(500).send(`Webhook handler error: ${message}`);
    }
  }
);

// Run on a dedicated port; Vite dev server (frontend) stays on 3000.
// Vite proxies /api/webhook/stripe to this server in development.
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Stripe webhook server running on port ${port}`);
});
