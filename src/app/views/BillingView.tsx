import { useState } from "react";
import { ArrowRight, CheckCircle, CreditCard, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Btn } from "../components/ui-primitives";

export interface BillingInfo {
  companyName: string;
  state: string;
  trialEndsAt: string;
  periodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasAccess: boolean;
  canManage: boolean;
  user: { id: string; name: string; email: string; role: "owner" | "manager" | "worker" };
  amount: number;
  currency: "INR";
  interval: "monthly";
}

export interface CheckoutDetails {
  keyId: string;
  subscriptionId: string;
  companyName: string;
  email: string;
  ownerName: string;
}

interface Props {
  billing: BillingInfo;
  onCheckout: () => Promise<CheckoutDetails>;
  onVerify: (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onCancel: () => Promise<void>;
  toast: (message: string) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function BillingView({ billing, onCheckout, onVerify, onRefresh, onCancel, toast }: Props) {
  const [busy, setBusy] = useState(false);
  const trial = billing.state === "trial" || (billing.state === "pending" && Date.parse(billing.trialEndsAt) > Date.now());
  const stateLabel: Record<string, string> = {
    trial: "Free trial",
    pending: "Payment setup pending",
    active: "Active",
    past_due: "Payment needs attention",
    halted: "Subscription paused",
    cancelled: "Cancelled",
    expired: "Expired",
  };

  async function beginCheckout() {
    setBusy(true);
    try {
      const checkout = await onCheckout();
      if (!(await loadRazorpayCheckout()) || !window.Razorpay) {
        throw new Error("Razorpay Checkout could not load. Check your internet connection and try again.");
      }
      const payment = new window.Razorpay({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: "TextilePay",
        description: "TextilePay monthly company subscription — ₹499",
        prefill: { name: checkout.ownerName, email: checkout.email },
        notes: { company: checkout.companyName },
        theme: { color: "#147d70" },
        handler: async (response: any) => {
          setBusy(true);
          try {
            await onVerify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast("Payment authorization received. Confirming your subscription status…");
          } catch (error) {
            toast(error instanceof Error ? error.message : "Unable to verify the Razorpay response.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      payment.open();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-10 sm:px-8">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">TextilePay billing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Company subscription</h1>
          <p className="mt-2 text-sm text-muted-foreground">{billing.companyName} · billed per company</p>
        </header>

        <article className="surface overflow-hidden rounded-3xl border border-border">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6 sm:p-8">
            <div>
              <Badge variant={billing.hasAccess ? "success" : "warning"}>{stateLabel[billing.state] ?? billing.state}</Badge>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-foreground">₹499<span className="ml-2 text-base font-normal text-muted-foreground">/ month</span></h2>
              <p className="mt-2 text-sm text-muted-foreground">One subscription covers the full company workspace and its team.</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CreditCard size={22} /></span>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{trial ? "Trial ends" : "Next renewal / access ends"}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{formatDate(trial ? billing.trialEndsAt : billing.periodEndsAt)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing cycle</p>
              <p className="mt-2 text-lg font-semibold text-foreground">Monthly · INR</p>
            </div>
          </div>

          <ul className="space-y-3 px-6 pb-6 text-sm text-muted-foreground sm:px-8">
            <li className="flex items-center gap-2"><CheckCircle size={16} className="text-primary" /> Owner, manager, and worker access</li>
            <li className="flex items-center gap-2"><CheckCircle size={16} className="text-primary" /> Production, attendance, payroll, and reports</li>
            <li className="flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> Recurring payments are handled by Razorpay</li>
          </ul>

          <div className="flex flex-col gap-3 border-t border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              {billing.canManage
                ? "The owner manages this plan. Payment authorization is completed securely through Razorpay."
                : "Your company subscription needs attention. Ask the company owner to renew access."}
            </p>
            {billing.canManage ? (
              <div className="flex flex-wrap gap-2">
                <Btn type="button" variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onRefresh(); } catch (error) { toast(error instanceof Error ? error.message : "Could not refresh billing status."); } finally { setBusy(false); } }}>
                  <RefreshCw size={15} /> Check status
                </Btn>
                {(!billing.hasAccess || trial) && <Btn type="button" disabled={busy} onClick={beginCheckout}>
                  {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  {trial ? "Subscribe for ₹499/month" : "Renew subscription"}
                </Btn>}
                {billing.hasAccess && !trial && !billing.cancelAtPeriodEnd && <Btn type="button" variant="secondary" disabled={busy} onClick={async () => {
                  if (!window.confirm("Cancel renewal at the end of the current paid month? Your company keeps access until then.")) return;
                  setBusy(true);
                  try { await onCancel(); toast("Subscription renewal cancelled. Access remains until the paid period ends."); }
                  catch (error) { toast(error instanceof Error ? error.message : "Unable to cancel renewal."); }
                  finally { setBusy(false); }
                }}>Cancel renewal</Btn>}
                {billing.cancelAtPeriodEnd && <Badge variant="warning">Cancels at period end</Badge>}
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
