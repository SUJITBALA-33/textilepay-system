import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, Factory, LoaderCircle } from "lucide-react";
import { Inp, Btn, type ToastFn } from "../components/ui-primitives";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  toast: ToastFn;
}

const factoryPhoto =
  "https://images.unsplash.com/photo-1742934029782-f2e6e5f0e169?auto=format&fit=crop&q=82&w=1600";

export function AuthScreen({ onLogin, toast }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    try {
      setSubmitting(true);
      await onLogin(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      const friendlyMessage = /failed to fetch|networkerror/i.test(message)
        ? "We couldn’t reach the TextilePay service. Check your connection and try again."
        : message;
      setErrorMessage(friendlyMessage);
      toast.error(friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout min-h-[100dvh] bg-background">
      <section className="login-visual relative isolate min-h-[218px] overflow-hidden sm:min-h-[250px] lg:min-h-[100dvh]">
        {!imageFailed && (
          <img
            src={factoryPhoto}
            srcSet={[
              "https://images.unsplash.com/photo-1742934029782-f2e6e5f0e169?auto=format&fit=crop&q=76&w=900 900w",
              "https://images.unsplash.com/photo-1742934029782-f2e6e5f0e169?auto=format&fit=crop&q=82&w=1600 1600w",
            ].join(", ")}
            sizes="(max-width: 1023px) 100vw, 54vw"
            alt="Garment worker sewing at an industrial machine on a factory floor"
            fetchPriority="high"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
        )}
        <div className="login-photo-overlay absolute inset-0 -z-10" />
        <div className="relative flex min-h-[218px] flex-col justify-between p-5 text-white sm:min-h-[250px] sm:p-7 lg:min-h-[100dvh] lg:p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-lg backdrop-blur-sm">
              <Factory size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold tracking-wide text-white">TextilePay</p>
              <p className="text-xs text-white/75">People &amp; production, in sync</p>
            </div>
          </div>

          <div className="login-hero-copy hidden max-w-xl lg:block">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">
              Made for the factory floor
            </p>
            <h1 className="max-w-lg font-normal leading-[1.08] text-white">
              Every shift. Every stitch. One clear picture.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
              Keep attendance, production progress, and payroll together in one
              practical workspace for your team.
            </p>
          </div>

          <div className="flex items-end justify-between gap-4 text-xs text-white/75">
            <span className="lg:hidden">Payroll and production, in sync.</span>
            <span className="hidden lg:block">A clearer view of the work behind every order.</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel flex items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Workforce &amp; payroll portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in to continue to your factory workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <Inp
              id="login-email"
              label="Work email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
              inputMode="email"
              required
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="form-control w-full pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((visible) => !visible)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                  className="absolute inset-y-1 right-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div role="alert" className="login-error flex gap-3 rounded-xl border px-4 py-3 text-sm leading-5">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Btn
              type="submit"
              className="login-submit mt-1 w-full justify-center"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in to workspace
                  <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </Btn>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Accounts are provided by your factory owner or manager. Contact
              them if you need access.
            </p>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            TextilePay <span aria-hidden="true">·</span> Factory payroll &amp; production
          </p>
        </div>
      </section>
    </main>
  );
}
