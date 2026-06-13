"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/routing";
import { useSession } from "next-auth/react";
import { useTranslations } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Leaf, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("auth");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Redirect if logged in - use useEffect to avoid setState during render
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading" || session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("invalidCredentials"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Inloggen mislukt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registratie mislukt");
        return;
      }

      // Auto-login after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push("/dashboard");
      } else {
        setIsLogin(true);
      }
    } catch {
      setError("Registratie mislukt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Google inloggen mislukt");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-background dark:via-background dark:to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary text-primary-foreground flex aspect-square size-14 items-center justify-center rounded-xl mb-4">
            <Leaf className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SEOCoach</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-driven SEO Automation
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>{isLogin ? t("loginTitle") : t("registerTitle")}</CardTitle>
            <CardDescription>
              {isLogin ? t("welcomeBack") : t("registerTitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign-In Button */}
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoading}
                onClick={handleGoogleLogin}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Inloggen met Google
              </Button>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">of</span>
              </div>
            </div>

            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t("email")}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("password")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("login")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setError("");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {t("registerHere")}
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">{t("name")}</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Jan Jansen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t("email")}</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">{t("password")}</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">{t("confirmPassword")}</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("register")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("hasAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setError("");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {t("loginHere")}
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
