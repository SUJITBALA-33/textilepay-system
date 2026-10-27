import { useState, useEffect, useCallback, useRef } from "react";
import { edgeFunctionBase, supabase } from "../lib/supabase";
import {
  type DB,
  type User,
  type View,
  createDefaultDB,
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

// Re-export domain models & utilities for backward compatibility & tests
export * from "../lib/payroll";
export { NAV_ITEMS };
export type { ViewProps };

async function fetchDBRemote(): Promise<DB | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${edgeFunctionBase}/db`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Unable to load your workspace.");
  return json.data ?? null;
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
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toasts, toast } = useToast();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(async (authUserId: string) => {
    const loaded = await fetchDBRemote();
    if (!loaded) throw new Error("No TextilePay workspace was returned.");
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
        if (session) await loadWorkspace(session.user.id);
      } catch (error) {
        await supabase.auth.signOut();
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
      const profile = await loadWorkspace(data.user.id);
      toast.success(`Welcome, ${profile.name}!`);
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    } finally {
      setLoading(false);
    }
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
    setDb(createDefaultDB());
    setSidebarOpen(false);
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p
          className="text-sm text-muted-foreground"
          style={{ fontFamily: "'Geologica', sans-serif" }}
        >
          Loading TextilePay…
        </p>
      </div>
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
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'Geologica', sans-serif" }}
    >
      <Sidebar
        user={currentUser}
        view={safeView}
        setView={navigate}
        pendingCount={pendingCount}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <TopBar
        onMenu={() => setSidebarOpen(!sidebarOpen)}
        pendingCount={currentUser.role === "owner" ? pendingCount : 0}
      />

      <main className="lg:ml-56 pt-12 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
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
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
