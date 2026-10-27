import React, { useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  X,
} from "lucide-react";
import {
  type Section,
  type Status,
  type ToastItem,
  SECTION_NAMES,
  SECTION_COLORS,
  genId,
} from "../../lib/payroll";

export type ToastFn = {
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, type: ToastItem["type"]) => {
    const id = genId();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return {
    toasts,
    toast: {
      success: (m: string) => addToast(m, "success"),
      error: (m: string) => addToast(m, "error"),
      warning: (m: string) => addToast(m, "warning"),
      info: (m: string) => addToast(m, "info"),
    },
  };
}

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  const icons = {
    success: <CheckCircle size={15} className="text-green-400 flex-shrink-0" />,
    error: <XCircle size={15} className="text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />,
    info: <AlertCircle size={15} className="text-blue-400 flex-shrink-0" />,
  };
  const borders = {
    success: "border-green-500/25 bg-green-950/80",
    error: "border-red-500/25 bg-red-950/80",
    warning: "border-amber-500/25 bg-amber-950/80",
    info: "border-blue-500/25 bg-blue-950/80",
  };
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border backdrop-blur-sm ${borders[t.type]}`}
        >
          {icons[t.type]}
          <span className="text-sm text-foreground leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
}) {
  const styles: Record<string, string> = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-green-900/50 text-green-400 border border-green-500/20",
    warning: "bg-amber-900/50 text-amber-400 border border-amber-500/20",
    error: "bg-red-900/50 text-red-400 border border-red-500/20",
    info: "bg-blue-900/50 text-blue-400 border border-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-card border border-border rounded-xl shadow-2xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2
            className="text-base font-medium text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            {label}
          </p>
          <p
            className="text-xl font-medium text-foreground truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
        </div>
        <div
          className="p-2.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: color + "20" }}
        >
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export function Inp({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        {...props}
        className={`w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          props.className ?? ""
        }`}
      />
    </div>
  );
}

export function Sel({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        {...props}
        className={`w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          props.className ?? ""
        }`}
      >
        {children}
      </select>
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center gap-1.5 font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90 active:scale-95",
    secondary:
      "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:text-accent-foreground",
    danger: "bg-red-900/30 text-red-400 border border-red-500/20 hover:bg-red-900/50",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  };
  return (
    <button
      {...props}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionTag({ section }: { section: Section }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-medium"
      style={{
        backgroundColor: SECTION_COLORS[section].bg,
        color: SECTION_COLORS[section].text,
      }}
    >
      {section} {SECTION_NAMES[section]}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, "success" | "warning" | "error" | "info"> = {
    approved: "success",
    pending: "warning",
    rejected: "error",
    deactivated: "info",
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}
