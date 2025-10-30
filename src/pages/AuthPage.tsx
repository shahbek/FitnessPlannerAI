import { useState } from "react";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

type AuthView = "login" | "signup" | "forgot-password";

export function AuthPage() {
  const [view, setView] = useState<AuthView>("login");

  if (view === "login") {
    return (
      <LoginPage
        onSwitchToSignup={() => setView("signup")}
        onForgotPassword={() => setView("forgot-password")}
      />
    );
  }

  if (view === "signup") {
    return (
      <SignupPage onSwitchToLogin={() => setView("login")} />
    );
  }

  return (
    <ForgotPasswordPage onBackToLogin={() => setView("login")} />
  );
}

