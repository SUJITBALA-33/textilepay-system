import { useState, useEffect, useCallback, useRef } from "react";
import { edgeFunctionBase, edgeFunctionHeaders, supabase } from "../lib/supabase";
import {
  type DB,
  type User,
  type View,
  createDefaultDB,
  DEFAULT_COMPANY_SECTIONS,
  viewFromHash,
} from "../lib/payroll";
import { useToast, ToastContainer } from "./components/ui-primitives";
import { Sidebar, NAV_ITEMS } from "./layout/Sidebar";
import { TopBar } from "./layout/TopBar";
import { AuthScreen } from "./views/AuthScreen";
import { DashboardView, type ViewProps } from "./views/DashboardView";
import { WorkersView } from "./views/WorkersView";
import { AccountsView } from "./views/AccountsView";
import { AttendanceView } from "./views/AttendanceView";
import { ProductionView } from "./views/ProductionView";
import { WorkerDashView } from "./views/WorkerDashView";
import { PayoutView } from "./views/PayoutView";
import { ReportsView } from "./views/ReportsView";
import { BillingView, type BillingInfo, type CheckoutDetails } from "./views/BillingView";

// Re-export domain models & utilities for backward compatibility & tests
export * from "../lib/payroll";
export { NAV_ITEMS };
export type { ViewProps };

function trialDaysRemaining(value: string) {
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return 0;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - todayUtc) / 86_400_000) + 1);
}

async function fetchDBRemote(): Promise<DB | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${edgeFunctionBase}/db`, {
    headers: { ...edgeFunctionHeaders, Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Unable to load your workspace.");
  return json.data ?? null;
}

async function fetchBillingRemote(): Promise<BillingInfo> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again to view company billing.");
  const res = await fetch(`${edgeFunctionBase}/billing/status`, {
    headers: { ...edgeFunctionHeaders, Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Billing service is not deployed yet. Apply the latest Supabase migrations and redeploy the make-server-32660b5b function.");
    }
    if (json.code === "BILLING_CONFIGURATION_REQUIRED") {
      throw new Error(json.error);
    }
    throw new Error(json.error || "Unable to load billing status. Check the Supabase billing migration and Edge Function deployment.");
  }
  return json as BillingInfo;
}

async function postBillingRemote(path: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  const res = await fetch(`${edgeFunctionBase}/billing/${path}`, {
    method: "POST",
    headers: {
      ...edgeFunctionHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Unable to process billing request.");
  return json;
}

async function saveDBRemote(db: DB): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    throw new Error("Your session has expired. Please sign in again.");
  const res = await fetch(`${edgeFunctionBase}/db`, {
    method: "POST",
    headers: {
      ...edgeFunctionHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(db),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Unable to save changes.");
}

async function createAccountRemote(
  form: Record<string, string>
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    throw new Error("Your session has expired. Please sign in again.");
  const res = await fetch(`${edgeFunctionBase}/users`, {
    method: "POST",
    headers: {
      ...edgeFunctionHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(form),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Unable to create the account.");
}

export default function App() {
  const [db, setDb] = useState<DB | null>(createDefaultDB());
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toasts, toast } = useToast();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(async (authUserId: string) => {
    const response = await fetchDBRemote();
    if (!response) throw new Error("No TextilePay workspace was returned.");
    // Keep the latest frontend compatible with an older deployed Edge Function
    // while its dynamic sections migration and function update are rolling out.
    const loaded: DB = {
      ...response,
      sections: Array.isArray(response.sections) && response.sections.length
        ? response.sections
        : DEFAULT_COMPANY_SECTIONS.map((section) => ({ ...section })),
    };
    const profile = loaded.users.find((user) => user.id === authUserId);
    if (!profile)
      throw new Error("Your profile is not configured. Contact the owner.");
    if (profile.status === "pending")
      throw new Error("Your account is pending owner approval.");
    if (profile.status === "rejected")
      throw new Error("Your account has been rejected.");
    if (profile.status === "deactivated")
      throw new Error("Your account has been deactivated.");
    setDb(loaded);
    setCurrentUser(profile);
    setView(viewFromHash(profile.role));
    return profile;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const billing = await fetchBillingRemote();
          setBillingInfo(billing);
          if (billing.hasAccess) await loadWorkspace(session.user.id);
        }
      } catch (error) {
        await supabase.auth.signOut();
        setBillingInfo(null);
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to restore your session."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorkspace, toast]);

  useEffect(() => {
    if (!currentUser) return;
    const syncView = () => setView(viewFromHash(currentUser.role));
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, [currentUser]);

  const updateDB = useCallback(
    (newDb: DB) => {
      setDb(newDb);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDBRemote(newDb).catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to save changes."
          );
        });
      }, 600);
    },
    [toast]
  );

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      throw new Error(error.message);
    }
    try {
      const billing = await fetchBillingRemote();
      setBillingInfo(billing);
      if (!billing.hasAccess) return;
      const profile = await loadWorkspace(data.user.id);
      window.history.replaceState(null, "", "/");
      toast.success(`Welcome, ${profile.name}!`);
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function startSubscriptionCheckout(): Promise<CheckoutDetails> {
    return await postBillingRemote("checkout") as CheckoutDetails;
  }

  async function refreshBillingStatus() {
    const billing = await fetchBillingRemote();
    setBillingInfo(billing);
    if (billing.hasAccess && !currentUser) await loadWorkspace(billing.user.id);
  }

  async function verifySubscription(response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) {
    await postBillingRemote("verify", {
      paymentId: response.razorpay_payment_id,
      subscriptionId: response.razorpay_subscription_id,
      signature: response.razorpay_signature,
    });
    await refreshBillingStatus();
  }

  async function cancelSubscription() {
    await postBillingRemote("cancel");
    await refreshBillingStatus();
  }

  async function handleCreateAccount(form: Record<string, string>) {
    await createAccountRemote(form);
    const refreshed = await fetchDBRemote();
    if (!refreshed)
      throw new Error(
        "Account was created, but the workspace could not be refreshed."
      );
    setDb(refreshed);
  }

  async function handleLogout() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (db) {
        try {
          await saveDBRemote(db);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to save before signing out."
          );
          return;
        }
      }
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    setBillingInfo(null);
    setDb(createDefaultDB());
    setSidebarOpen(false);
    window.history.replaceState(null, "", "/");
  }

  function navigate(nextView: View) {
    setView(nextView);
    window.history.replaceState(null, "", `#/${nextView}`);
    setSidebarOpen(false);
  }

  // Refresh user from DB when DB changes (e.g. status update)
  useEffect(() => {
    if (!currentUser || !db) return;
    const fresh = db.users.find((u) => u.id === currentUser.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser)) {
      setCurrentUser(fresh);
    }
  }, [db, currentUser]);

  if (loading || !db) {
    return (
      <div className="min-h-[100dvh] bg-background" aria-busy="true" aria-label="Loading TextilePay">
        <a className="skip-link" href="#loading-content">Skip to content</a>
        <div className="mx-auto flex min-h-[100dvh] max-w-[1600px]">
          <div className="hidden w-[260px] shrink-0 border-r border-border bg-sidebar p-6 lg:block">
            <div className="mb-10 h-8 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-10 animate-pulse rounded-xl bg-muted" />)}
            </div>
          </div>
          <main id="loading-content" className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
            <p role="status" className="sr-only">Loading TextilePay…</p>
            <div className="mb-8 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-64 max-w-[60vw] animate-pulse rounded-md bg-muted" />
              </div>
              <div className="hidden h-10 w-32 animate-pulse rounded-xl bg-muted sm:block" />
            </div>
            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />)}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
              <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (billingInfo && !billingInfo.hasAccess) {
    return (
      <>
        <BillingView
          billing={billingInfo}
          onCheckout={startSubscriptionCheckout}
          onVerify={verifySubscription}
          onRefresh={refreshBillingStatus}
          onCancel={cancelSubscription}
          toast={(message) => toast.error(message)}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const pendingCount = db.users.filter((u) => u.status === "pending").length;

  const viewProps: ViewProps = {
    db,
    update: updateDB,
    user: currentUser!,
    toast,
    createAccount: handleCreateAccount,
  };

  if (!currentUser) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} toast={toast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const allowedViews = (NAV_ITEMS[currentUser.role] ?? []).map((i) => i.id);
  const safeView = (allowedViews.includes(view) ? view : allowedViews[0]) as View;

  return (
    <div className="min-h-[100dvh] bg-background" style={{ fontFamily: "'Geologica', sans-serif" }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar
        user={currentUser}
        view={safeView}
        setView={navigate}
        pendingCount={pendingCount}
        companyName={db.company?.name ?? "TextilePay"}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <TopBar
        onMenu={() => setSidebarOpen(!sidebarOpen)}
        menuOpen={sidebarOpen}
        pendingCount={currentUser.role === "owner" ? pendingCount : 0}
        companyName={db.company?.name ?? "TextilePay"}
      />

      <main id="main-content" tabIndex={-1} className="app-main min-h-[100dvh] pt-[66px] lg:ml-64">
        {billingInfo && ["trial", "pending"].includes(billingInfo.state) && Date.parse(billingInfo.trialEndsAt) > Date.now() && (
          <div role="status" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-6 lg:mx-8">
            <span>
              Company free trial: <strong>{trialDaysRemaining(billingInfo.trialEndsAt)} days remaining</strong>
              {billingInfo.canManage ? ". Subscribe any time from Billing & Plan." : ". Your company owner manages the plan."}
            </span>
            {billingInfo.canManage && <button type="button" onClick={() => navigate("billing")} className="min-h-10 rounded-lg px-3 font-semibold text-amber-950 underline underline-offset-2">Manage plan</button>}
          </div>
        )}
        <div className="page-content mx-auto w-full max-w-[1440px] px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {safeView === "dashboard" && currentUser.role === "owner" && (
            <DashboardView {...viewProps} />
          )}
          {safeView === "workers" && currentUser.role === "owner" && (
            <WorkersView {...viewProps} />
          )}
          {safeView === "accounts" && currentUser.role === "manager" && (
            <AccountsView {...viewProps} />
          )}
          {safeView === "attendance" && <AttendanceView {...viewProps} />}
          {safeView === "production" && <ProductionView {...viewProps} />}
          {safeView === "mywork" && currentUser.role === "worker" && (
            <WorkerDashView {...viewProps} />
          )}
          {safeView === "payout" && currentUser.role === "owner" && (
            <PayoutView {...viewProps} />
          )}
          {safeView === "reports" && currentUser.role === "owner" && (
            <ReportsView {...viewProps} />
          )}
          {safeView === "billing" && currentUser.role === "owner" && billingInfo && (
            <BillingView
              billing={billingInfo}
              onCheckout={startSubscriptionCheckout}
              onVerify={verifySubscription}
              onRefresh={refreshBillingStatus}
              onCancel={cancelSubscription}
              toast={(message) => toast.error(message)}
            />
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
