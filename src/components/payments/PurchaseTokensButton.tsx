import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { TokenPackageId } from '@/services/PaymentService';

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
  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);

  const handlePurchase = async () => {
    setIsLoading(true);
    
    try {
      // Create Stripe checkout session via Convex
      const result = await createCheckoutSession({ packageId });
      
      if (!result.checkoutUrl) {
        // Stripe key not configured or testing mode
        if (result.requiresStripeKey) {
          toast({
            title: "Stripe not configured",
            description: "Please set STRIPE_SECRET_KEY in Convex dashboard. For testing, you can manually add tokens.",
            variant: "default",
          });
        } else {
          toast({
            title: "Checkout unavailable",
            description: "Unable to create checkout session. Please try again later.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        // User will be redirected, so keep loading state
        return;
      }

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

