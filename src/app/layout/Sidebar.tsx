import React from "react";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Calendar,
  Factory,
  Wallet,
  Printer,
  X,
} from "lucide-react";
import { type Role, type User, type View } from "../../lib/payroll";

export const NAV_ITEMS: Record<Role, { id: View; label: string; icon: React.ElementType }[]> = {
  owner: [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "workers", label: "Workers & rates", icon: Users },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "production", label: "Production", icon: Factory },
    { id: "payout", label: "Payroll & payouts", icon: Wallet },
    { id: "reports", label: "Reports", icon: Printer },
  ],
  manager: [
    { id: "accounts", label: "Team operations", icon: Users },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "production", label: "Production", icon: Factory },
  ],
  worker: [{ id: "mywork", label: "My work", icon: LayoutDashboard }],
};

interface SidebarProps {
  user: User;
  view: View;
  setView: (v: View) => void;
  pendingCount: number;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  companyName: string;
}

export function Sidebar({
  user,
  view,
  setView,
  pendingCount,
  onLogout,
  open,
  onClose,
  companyName,
}: SidebarProps) {
  const items = NAV_ITEMS[user.role] ?? [];

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-label="Close navigation menu"
        />
      )}
      <aside
        id="primary-navigation"
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-[82px] items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/15">
              <Factory size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight text-white" title={companyName}>{companyName}</p>
              <p className="text-[11px] uppercase tracking-[0.13em] text-white/55">TextilePay workspace</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <div className="px-5 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Workspace
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-5">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    onClose();
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`nav-item group flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-white/12 font-semibold text-white shadow-inner shadow-white/5"
                      : "text-white/68 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.id === "workers" && pendingCount > 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
                      {pendingCount}
                      <span className="sr-only"> pending approvals</span>
                    </span>
                  )}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sm font-semibold text-sidebar-primary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="mt-0.5 text-xs capitalize text-white/55">{user.role} account</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
