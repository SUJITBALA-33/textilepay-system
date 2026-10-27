import { Menu, Bell } from "lucide-react";

interface TopBarProps {
  onMenu: () => void;
  pendingCount: number;
}

export function TopBar({ onMenu, pendingCount }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 lg:left-56 z-20 h-12 bg-card/80 border-b border-border backdrop-blur-sm flex items-center px-4 gap-3">
      <button
        onClick={onMenu}
        aria-label="Open navigation menu"
        className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
      >
        <Menu size={18} />
      </button>
      <div className="flex-1" />
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/30 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          <Bell size={13} />
          {pendingCount} pending
        </div>
      )}
    </header>
  );
}
