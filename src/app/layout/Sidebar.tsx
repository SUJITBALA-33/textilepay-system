import React from "react";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Calendar,
  Factory,
  Wallet,
  Printer,
} from "lucide-react";
import { type Role, type User, type View } from "../../lib/payroll";

export const NAV_ITEMS: Record<Role, { id: View; label: string; icon: React.ElementType }[]> = {
  owner: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "workers", label: "Workers & Rates", icon: Users },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "production", label: "Production", icon: Factory },
    { id: "payout", label: "Payout", icon: Wallet },
    { id: "reports", label: "Reports", icon: Printer },
  ],
  manager: [
    { id: "accounts", label: "Add Worker", icon: Users },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "production", label: "Production", icon: Factory },
  ],
  worker: [
    { id: "mywork", label: "My Dashboard", icon: LayoutDashboard },
  ],
};

interface SidebarProps {
  user: User;
  view: View;
  setView: (v: View) => void;
  pendingCount: number;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  user,
  view,
  setView,
  pendingCount,
  onLogout,
  open,
  onClose,
}: SidebarProps) {
  const items = NAV_ITEMS[user.role] ?? [];
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 w-56 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Factory size={14} className="text-primary-foreground" />
          </div>
          <span
            className="text-lg text-sidebar-foreground font-normal"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            TextilePay
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 cursor-pointer ${
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon size={16} />
                {item.label}
                {item.id === "workers" && pendingCount > 0 && (
                  <span className="ml-auto text-xs bg-amber-500 text-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-semibold">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors cursor-pointer"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
