import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { TokenPackageId, TOKEN_PACKAGES } from '@/services/PaymentService';

interface PurchaseTokensButtonProps {
  packageId: TokenPackageId;
  packageName: string;
  tokens: number;
  price: number;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  className?: string;
}

export function PurchaseTokensButton({
  packageId,
  packageName,
  variant = "default",
  className,
}: PurchaseTokensButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const user = useQuery(api.users.getCurrentUser);

  const handlePurchase = async () => {
    setIsLoading(true);
    
    try {
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in before purchasing tokens.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const pkg = TOKEN_PACKAGES[packageId];
      if (!pkg) {
        toast({
          title: "Invalid package",
          description: "Selected token package is not available.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const paymentLinkEnvKey = `VITE_STRIPE_${packageId.toUpperCase()}_PAYMENT_LINK` as
        | "VITE_STRIPE_STARTER_PAYMENT_LINK"
        | "VITE_STRIPE_PROFESSIONAL_PAYMENT_LINK"
        | "VITE_STRIPE_ENTERPRISE_PAYMENT_LINK";

      const baseLink =
        import.meta.env[paymentLinkEnvKey] ||
        (packageId === "starter"
          ? "https://buy.stripe.com/test_dRm9ASh183sm1Ol8x6cQU00"
          : "");

      if (!baseLink) {
        toast({
          title: "Payment link not configured",
          description: "This plan's Stripe payment link is not set up yet.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const url = new URL(baseLink);

      // Attach Convex user id so webhook can credit tokens
      if (user._id) {
        url.searchParams.set("client_reference_id", user._id as string);
      }

      // Optional: prefill email in Stripe checkout
      if (user.email) {
        url.searchParams.set("prefilled_email", user.email);
      }

      window.location.href = url.toString();
      // User will be redirected, so keep loading state
      return;
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePurchase}
      disabled={isLoading}
      variant={variant}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        `Purchase ${packageName}`
      )}
    </Button>
  );
}
