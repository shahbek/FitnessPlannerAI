import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
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

  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);

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

      // Use server-side session creation to securely attach userId
      // This ensures tokens are credited to THIS account regardless of payment email
      const result = await createCheckoutSession({ packageId });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else if (result.requiresStripeKey) {
        // Fallback for development without Stripe keys
        toast({
          title: "Development Mode",
          description: "Stripe keys not configured. Check console for package details.",
        });
        console.log("Mock Purchase Details:", result);
        setIsLoading(false);
      } else {
        throw new Error("Failed to generate checkout URL");
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
