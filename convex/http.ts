import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { handleStripeWebhook } from "./payments";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Stripe webhook endpoint
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: handleStripeWebhook,
});

export default http;

