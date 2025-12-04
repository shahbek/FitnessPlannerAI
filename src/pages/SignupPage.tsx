import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

import logo from "@/assets/logo.svg";

export function SignupPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Submitting sign up with Better Auth...');

      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        // Handle specific error types
        if (result.error.message?.includes('already exists') || result.error.message?.includes('duplicate')) {
          setError("An account with this email already exists. Please sign in instead.");
        } else if (result.error.message?.includes('invalid email')) {
          setError("Please enter a valid email address.");
        } else {
          setError(result.error.message || "Failed to create account. Please try again.");
        }
        setLoading(false);
        return;
      }

      console.log('✅ Sign up successful!');
      // Better Auth will automatically create session
    } catch (err: any) {
      console.error('❌ Sign up error:', err);
      setError(err.message || "Failed to create account. Please try again.");
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
            <h1 className="text-2xl font-bold">Create Your Account</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Start your personalized fitness journey today
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </div>
          <div className="text-center text-sm">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

