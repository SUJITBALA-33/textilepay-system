import React, { useState, useCallback, useId } from "react";
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
  sectionLabel,
  sectionColor,
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
    success: <CheckCircle size={17} className="status-icon-success shrink-0" />,
    error: <XCircle size={17} className="status-icon-error shrink-0" />,
    warning: <AlertTriangle size={17} className="status-icon-warning shrink-0" />,
    info: <AlertCircle size={17} className="status-icon-info shrink-0" />,
  };
  const borders = {
    success: "toast-success",
    error: "toast-error",
    warning: "toast-warning",
    info: "toast-info",
  };
  return (
    <div aria-live="polite" className="fixed right-3 top-3 z-[9999] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5 sm:top-5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg ${borders[t.type]}`}
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
    default: "bg-secondary text-secondary-foreground border border-border",
    success: "badge-success",
    warning: "badge-warning",
    error: "badge-error",
    info: "badge-info",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[variant]}`}
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
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
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
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`surface relative w-full ${widths[size]} max-h-[min(90dvh,48rem)] overflow-y-auto shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-sm sm:px-6">
          <h2 id="modal-title"
            className="text-base font-medium text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
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
    <div className="surface stat-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            {label}
          </p>
          <p
            className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
        </div>
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: color + "18" }}
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
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={`form-control ${
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
  const generatedId = useId();
  const selectId = props.id ?? generatedId;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        {...props}
        id={selectId}
        className={`form-control ${
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background,color,transform,box-shadow] duration-150 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer";
  const sizes = { sm: "min-h-10 px-3.5 text-xs", md: "min-h-11 px-4 text-sm" };
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground shadow-sm hover:bg-teal-800 active:translate-y-px",
    secondary:
      "border border-border bg-white text-secondary-foreground hover:bg-secondary",
    danger: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
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

export function SectionTag({ section, label }: { section: Section; label?: string }) {
  const colors = sectionColor(section);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {section} {label ?? sectionLabel(section)}
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
