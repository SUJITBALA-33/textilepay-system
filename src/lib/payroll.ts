// ===================== TYPES =====================

export type Role = "owner" | "manager" | "worker";
export type Status = "pending" | "approved" | "rejected" | "deactivated";
export type PayType = "piece" | "daily";
export type Section = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export type View = "dashboard" | "workers" | "accounts" | "attendance" | "production" | "mywork" | "payout" | "reports";

export interface User {
  id: string;
  companyId: string;
  email: string;
  name: string;
  mobile: string;
  username: string;
  address: string;
  aadhaar: string;
  bankDetails: string;
  upi: string;
  emergencyContact: string;
  dob: string;
  joinDate: string;
  role: Role;
  status: Status;
  pfEnabled?: boolean;
  esiEnabled?: boolean;
  section?: Section;
  payType?: PayType;
  dailyRate?: number;
  hourlyOT?: number;
  workDays?: number;
  monthlySalary?: number;
}

export interface Order {
  id: string;
  name: string;
  target: number;
  revenue: number;
  costs: number;
  stages: Record<Section, number>;
  createdAt: string;
  status: "active" | "completed";
}

export interface AttendanceRecord {
  present: number;
  otHours: number;
}

export interface Submission {
  id: string;
  userId: string;
  orderId: string;
  section: Section;
  pieces: number;
  note: string;
  timestamp: string;
  month: string;
}

export interface Payment {
  id: string;
  userId: string;
  month: string;
  base: number;
  ot: number;
  gross: number;
  poolShare: number;
  finalPay: number;
  pf: number;
  esiEmployee: number;
  esiEmployer: number;
  net: number;
  paid: boolean;
  paidAt?: string;
}

export interface DB {
  company: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  users: User[];
  orders: Order[];
  pieceRates: Record<Section, number>;
  attendance: Record<string, Record<string, AttendanceRecord>>;
  submissions: Submission[];
  payments: Payment[];
  settings: {
    ownerReservePercent: number;
    otMultiplier: number;
    maxHours: number;
  };
}

export interface SalaryInfo {
  userId: string;
  base: number;
  ot: number;
  gross: number;
  poolShare: number;
  finalPay: number;
  pf: number;
  esiEmployee: number;
  esiEmployer: number;
  net: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

// ===================== CONSTANTS =====================

export const SECTION_NAMES: Record<Section, string> = {
  S1: "Cutting",
  S2: "Stitching",
  S3: "Embroidery",
  S4: "Checking",
  S5: "Finishing",
  S6: "Packing",
};

export const SECTION_COLORS: Record<Section, { bg: string; text: string }> = {
  S1: { bg: "#7c2d12", text: "#fb923c" },
  S2: { bg: "#1e3a5f", text: "#60a5fa" },
  S3: { bg: "#3b0764", text: "#c084fc" },
  S4: { bg: "#064e3b", text: "#34d399" },
  S5: { bg: "#7f1d1d", text: "#f87171" },
  S6: { bg: "#14532d", text: "#4ade80" },
};

export const SECTIONS: Section[] = ["S1", "S2", "S3", "S4", "S5", "S6"];

export const NAV_ITEMS_DEFINITIONS: Record<Role, { id: View; label: string }[]> = {
  owner: [
    { id: "dashboard", label: "Dashboard" },
    { id: "workers", label: "Workers & Rates" },
    { id: "attendance", label: "Attendance" },
    { id: "production", label: "Production" },
    { id: "payout", label: "Payout" },
    { id: "reports", label: "Reports" },
  ],
  manager: [
    { id: "accounts", label: "Add Worker" },
    { id: "attendance", label: "Attendance" },
    { id: "production", label: "Production" },
  ],
  worker: [
    { id: "mywork", label: "My Dashboard" },
  ],
};

export const NAV_ITEMS = NAV_ITEMS_DEFINITIONS;

export const DEFAULT_VIEW: Record<Role, View> = {
  owner: "dashboard",
  manager: "attendance",
  worker: "mywork",
};

export function viewFromHash(role: Role): View {
  if (typeof window === "undefined" || !window.location) return DEFAULT_VIEW[role];
  const requested = window.location.hash.replace(/^#\/?/, "") as View;
  const allowed = NAV_ITEMS_DEFINITIONS[role].map(item => item.id);
  return allowed.includes(requested) ? requested : DEFAULT_VIEW[role];
}

// ===================== DB HELPERS =====================

export function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

export function getMonthOptions(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

export function createDefaultDB(): DB {
  const pieceRates: Record<Section, number> = {
    S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0,
  };

  return {
    company: null,
    users: [],
    orders: [],
    pieceRates,
    attendance: {},
    submissions: [],
    payments: [],
    settings: { ownerReservePercent: 20, otMultiplier: 1.5, maxHours: 8 },
  };
}

// ===================== SALARY UTILS =====================

export function calcSalaries(month: string, db: DB): Map<string, SalaryInfo> {
  const workers = db.users.filter(u => u.role === "worker" && u.status === "approved");
  const grossMap = new Map<string, { base: number; ot: number; gross: number }>();

  for (const w of workers) {
    const att = db.attendance[w.id]?.[month] ?? { present: 0, otHours: 0 };
    let base = 0;
    if (w.payType === "daily") {
      base = att.present * (w.dailyRate ?? 0);
    } else {
      const pieces = db.submissions
        .filter(s => s.userId === w.id && s.month === month)
        .reduce((s, x) => s + x.pieces, 0);
      base = pieces * (db.pieceRates[w.section!] ?? 0);
    }
    const ot = att.otHours * (w.hourlyOT ?? 0) * db.settings.otMultiplier;
    grossMap.set(w.id, { base, ot, gross: base + ot });
  }

  const totalGross = Array.from(grossMap.values()).reduce((s, v) => s + v.gross, 0);
  const totalRev = db.orders.reduce((s, o) => s + o.revenue, 0);
  const totalCost = db.orders.reduce((s, o) => s + o.costs, 0);
  const workerPool = Math.max(0, (totalRev - totalCost) * (1 - db.settings.ownerReservePercent / 100));

  const result = new Map<string, SalaryInfo>();
  for (const w of workers) {
    const { base, ot, gross } = grossMap.get(w.id) ?? { base: 0, ot: 0, gross: 0 };
    const finalPay = totalGross > 0 ? workerPool * (gross / totalGross) : 0;
    const pfEnabled = w.pfEnabled !== false;
    const esiEnabled = w.esiEnabled !== false;
    const pf = pfEnabled ? Math.min(gross, 15000) * 0.12 : 0;
    const esiEmployee = (esiEnabled && gross <= 21000) ? gross * 0.0075 : 0;
    const esiEmployer = (esiEnabled && gross <= 21000) ? gross * 0.0325 : 0;
    result.set(w.id, {
      userId: w.id,
      base,
      ot,
      gross,
      poolShare: finalPay,
      finalPay,
      pf,
      esiEmployee,
      esiEmployer,
      net: finalPay - pf - esiEmployee,
    });
  }
  return result;
}

export function updateOrderStage(order: Order, stage: Section, value: number): Order {
  const stages = { ...order.stages };
  const idx = SECTIONS.indexOf(stage);
  const maxVal = idx === 0 ? order.target : stages[SECTIONS[idx - 1]];
  const clamped = Math.max(0, Math.min(value, maxVal));
  stages[stage] = clamped;
  let cap = clamped;
  for (let i = idx + 1; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    if (stages[s] > cap) stages[s] = cap;
    cap = stages[s];
  }
  return { ...order, stages };
}

export function formatUpiIntent(upi: string, name: string, amount: number, note: string): string {
  if (!upi) return "";
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(note);
  return `upi://pay?pa=${upi}&am=${Math.round(amount)}&pn=${encodedName}&tn=${encodedNote}`;
}

export function calcRemainingCapacity(order: Order, section: Section, submissions: Submission[]): number {
  const used = submissions
    .filter(s => s.orderId === order.id && s.section === section)
    .reduce((s, x) => s + x.pieces, 0);
  return Math.max(0, order.stages[section] - used);
}
