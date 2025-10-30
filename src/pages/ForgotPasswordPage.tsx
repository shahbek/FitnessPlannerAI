import { useState } from "react";
import { forgetPassword } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export function ForgotPasswordPage({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      console.log('🔐 Requesting password reset...');
      
      const result = await forgetPassword({
        email,
        redirectTo: "/reset-password", // Where to redirect after clicking reset link
      });
      
      if (result.error) {
        setError(result.error.message || "Failed to send reset email. Please try again.");
        setLoading(false);
        return;
      }
      
      setSuccess(true);
      console.log('✅ Password reset email sent!');
    } catch (err: any) {
      console.error('❌ Password reset error:', err);
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md p-8">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </button>

        {success ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Check your email</h2>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Didn't receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => {
                    setSuccess(false);
                    setEmail("");
                  }}
                  className="text-primary underline"
                >
                  try again
                </button>
              </p>
            </div>
            <Button onClick={onBackToLogin} className="w-full mt-4">
              Return to login
            </Button>
          </div>
        ) : (
          <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Forgot your password?</h1>
              <p className="text-balance text-sm text-muted-foreground">
                Enter your email address and we'll send you a link to reset your password
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Sign in
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

