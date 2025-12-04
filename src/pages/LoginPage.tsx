import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

import logo from "@/assets/logo.svg";

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex flex-col items-center gap-3 mb-6">
              <img src={logo} alt="Supercomp Logo" className="w-16 h-16" />
              <span className="text-4xl font-bold tracking-tight text-foreground font-editorial">
                Supercomp
              </span>
            </div>
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

            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={async () => {
                await signIn.social({
                  provider: "google",
                  callbackURL: "/dashboard",
                });
              }}
            >
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Continue with Google
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

