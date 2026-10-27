import { Bell, Menu } from "lucide-react";

interface TopBarProps {
  onMenu: () => void;
  menuOpen: boolean;
  pendingCount: number;
  companyName: string;
}

export function TopBar({ onMenu, menuOpen, pendingCount, companyName }: TopBarProps) {
  return (
    <header className="app-topbar fixed right-0 top-0 z-20 flex h-[66px] items-center gap-3 border-b border-border bg-white/90 px-3 backdrop-blur-xl sm:px-6 lg:left-64 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-foreground shadow-sm transition hover:bg-muted lg:hidden"
      >
        <Menu size={19} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 lg:hidden">
        <p className="truncate text-sm font-semibold text-foreground" title={companyName}>{companyName}</p>
        <p className="text-[11px] text-muted-foreground">TextilePay workspace</p>
      </div>
      <div className="hidden flex-1 items-center gap-2 text-sm text-muted-foreground lg:flex">
        <span className="max-w-[40vw] truncate font-semibold text-foreground" title={companyName}>{companyName}</span>
        <span aria-hidden="true">/</span> People <span aria-hidden="true">/</span> production <span aria-hidden="true">/</span> payroll
      </div>
      {pendingCount > 0 && (
        <div className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900">
          <Bell size={15} aria-hidden="true" />
          <span>{pendingCount} pending approval{pendingCount === 1 ? "" : "s"}</span>
        </div>
      )}
    </header>
  );
}
