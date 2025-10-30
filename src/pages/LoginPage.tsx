import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export function LoginPage({ 
  onSwitchToSignup, 
  onForgotPassword 
}: { 
  onSwitchToSignup: () => void;
  onForgotPassword?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log('🔐 Submitting sign in with Better Auth...');
      
      const result = await signIn.email({
        email,
        password,
      });
      
      if (result.error) {
        // Handle specific error types
        if (result.error.message?.includes('Invalid') || result.error.message?.includes('credentials')) {
          setError("Invalid email or password. Please try again.");
        } else if (result.error.message?.includes('not found')) {
          setError("No account found with this email. Please sign up first.");
        } else {
          setError(result.error.message || "Failed to sign in. Please try again.");
        }
        setLoading(false);
        return;
      }
      
      console.log('✅ Sign in successful!');
      // Better Auth will automatically update the session
    } catch (err: any) {
      console.error('❌ Sign in error:', err);
      setError(err.message || "Failed to sign in. Please check your credentials.");
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md p-8">
        <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Sign in to access your fitness journey
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
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
          <div className="text-center text-sm">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

