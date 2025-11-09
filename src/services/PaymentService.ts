// Payment Service for handling Stripe checkout
// This service handles client-side Stripe integration

export type TokenPackageId = "starter" | "professional" | "enterprise";

export interface TokenPackage {
  id: TokenPackageId;
  name: string;
  tokens: number;
  price: number;
  plans: number;
  bonus?: string;
  description: string;
}

export const TOKEN_PACKAGES: Record<TokenPackageId, TokenPackage> = {
  starter: {
    id: "starter",
    name: "Starter",
    tokens: 700,
    price: 10.00,
    plans: 7,
    description: "Perfect for trying out the service",
  },
  professional: {
    id: "professional",
    name: "Professional",
    tokens: 2000,
    price: 25.00,
    plans: 20,
    bonus: "20% bonus",
    description: "Best value for regular users",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tokens: 4500,
    price: 50.00,
    plans: 45,
    bonus: "29% bonus",
    description: "Maximum value for power users",
  },
};

export class PaymentService {
  /**
   * Create Stripe checkout session
   * In production, this would call your backend to create a Stripe checkout session
   * For now, returns the package info for direct Stripe integration
   */
  static async createCheckoutSession(
    packageId: TokenPackageId,
    userId: string,
    userEmail: string
  ): Promise<{ url?: string; package: TokenPackage }> {
    const pkg = TOKEN_PACKAGES[packageId];
    if (!pkg) {
      throw new Error("Invalid package ID");
    }

    // In production, this would:
    // 1. Call backend API to create Stripe checkout session
    // 2. Return the checkout session URL
    // 3. Redirect user to Stripe checkout

    // For now, return package info
    // The actual Stripe integration will be handled by the component
    return {
      package: pkg,
      // url: checkoutSession.url (from backend)
    };
  }

  /**
   * Handle successful payment redirect
   * Called after user returns from Stripe checkout
   */
  static async handlePaymentSuccess(sessionId: string): Promise<boolean> {
    // In production, verify the payment with your backend
    // The webhook will handle token crediting, but this can show immediate feedback
    
    try {
      // Could poll backend to check if tokens were added
      // Or rely on webhook + real-time updates
      return true;
    } catch (error) {
      console.error("Payment verification failed:", error);
      return false;
    }
  }

  /**
   * Get Stripe publishable key from environment
   */
  static getStripePublishableKey(): string {
    return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  }

  /**
   * Check if Stripe is configured
   */
  static isStripeConfigured(): boolean {
    return !!this.getStripePublishableKey();
  }
}
