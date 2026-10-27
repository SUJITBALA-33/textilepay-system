import React, { useState } from "react";
import { Factory, Eye, EyeOff } from "lucide-react";
import { Inp, Btn, type ToastFn } from "../components/ui-primitives";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  toast: ToastFn;
}

export function AuthScreen({ onLogin, toast }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onLogin(email.trim(), password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Factory size={20} className="text-primary-foreground" />
            </div>
            <h1
              className="text-3xl text-foreground"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              TextilePay
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Factory Payroll &amp; Production System
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 shadow-xl"
        >
          <Inp
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <Btn
            type="submit"
            className="w-full justify-center"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </Btn>
          <p className="text-xs text-center text-muted-foreground">
            Accounts are created by an owner or manager.
          </p>
        </form>
      </div>
    </div>
  );
}
