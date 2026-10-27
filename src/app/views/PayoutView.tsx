import { useState, useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  IndianRupee,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import {
  type Payment,
  type SalaryInfo,
  type User,
  calcSalaries,
  currentMonth,
  formatMoney,
  formatMonth,
  formatUpiIntent,
  genId,
  getMonthOptions,
} from "../../lib/payroll";
import {
  Badge,
  Btn,
  SectionTag,
  Sel,
  StatCard,
} from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function PayoutView({ db, update, toast }: ViewProps) {
  const [month, setMonth] = useState(currentMonth());
  const salaries = useMemo(() => calcSalaries(month, db), [month, db]);
  const workers = db.users.filter(
    (u) => u.role === "worker" && u.status === "approved"
  );
  const managers = db.users.filter(
    (u) => u.role === "manager" && u.status === "approved"
  );

  const totalRev = db.orders.reduce((s, o) => s + o.revenue, 0);
  const totalCost = db.orders.reduce((s, o) => s + o.costs, 0);
  const workerPool = Math.max(
    0,
    (totalRev - totalCost) * (1 - db.settings.ownerReservePercent / 100)
  );
  const ownerReserve = Math.max(
    0,
    (totalRev - totalCost) * (db.settings.ownerReservePercent / 100)
  );

  function isPaid(userId: string): boolean {
    return db.payments.some(
      (p) => p.userId === userId && p.month === month && p.paid
    );
  }

  function markPaid(u: User, _amount: number, sal?: SalaryInfo) {
    if (isPaid(u.id)) {
      toast.warning("Already paid for this month");
      return;
    }
    const payment: Payment = {
      id: genId(),
      userId: u.id,
      month,
      base: sal?.base ?? u.monthlySalary ?? 0,
      ot: sal?.ot ?? 0,
      gross: sal?.gross ?? u.monthlySalary ?? 0,
      poolShare: sal?.poolShare ?? 0,
      finalPay: sal?.finalPay ?? u.monthlySalary ?? 0,
      pf: sal?.pf ?? 0,
      esiEmployee: sal?.esiEmployee ?? 0,
      esiEmployer: sal?.esiEmployer ?? 0,
      net: sal?.net ?? u.monthlySalary ?? 0,
      paid: true,
      paidAt: new Date().toISOString(),
    };
    update({ ...db, payments: [...db.payments, payment] });
    toast.success(`Payment recorded for ${u.name}`);
  }

  function upiLink(u: User, amount: number): string {
    return formatUpiIntent(
      u.upi,
      u.name,
      amount,
      `Salary ${formatMonth(month)}`
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Payroll &amp; payouts
          </h1>
          <p className="text-sm text-muted-foreground">
            Review monthly earnings, deductions, and recorded payments.
          </p>
        </div>
        <Sel label="Payroll month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {getMonthOptions().map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </Sel>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Total Revenue"
          value={formatMoney(totalRev)}
          sub="All orders combined"
          icon={TrendingUp}
          color="#4ade80"
        />
        <StatCard
          label="Worker Pool"
          value={formatMoney(workerPool)}
          sub={`After ${db.settings.ownerReservePercent}% owner reserve`}
          icon={Wallet}
          color="#d4921a"
        />
        <StatCard
          label="Owner Reserve"
          value={formatMoney(ownerReserve)}
          sub={`${db.settings.ownerReservePercent}% of net profit`}
          icon={IndianRupee}
          color="#c084fc"
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Workers — Piece/Daily Rate Pool
        </h2>
        <div className="space-y-3">
          {workers.map((w) => {
            const sal = salaries.get(w.id);
            if (!sal) return null;
            const paid = isPaid(w.id);
            const link = upiLink(w, sal.net);
            return (
              <div
                key={w.id}
                className={`bg-card border rounded-xl p-4 transition-colors ${
                  paid
                    ? "border-green-500/20 bg-green-950/10"
                    : "border-border"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {w.name}
                      </span>
                      {w.section && <SectionTag section={w.section} label={db.sections.find((section) => section.code === w.section)?.name} />}
                      <Badge
                        variant={w.payType === "piece" ? "info" : "default"}
                      >
                        {w.payType}
                      </Badge>
                      {paid && <Badge variant="success">Paid</Badge>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Gross: </span>
                        <span className="font-mono text-foreground">
                          {formatMoney(sal.gross)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OT: </span>
                        <span className="font-mono text-foreground">
                          {formatMoney(sal.ot)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Pool Share:{" "}
                        </span>
                        <span className="font-mono text-amber-400">
                          {formatMoney(sal.finalPay)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          PF (12%):{" "}
                        </span>
                        <span className="font-mono text-red-400">
                          -{formatMoney(sal.pf)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          ESI (emp):{" "}
                        </span>
                        <span className="font-mono text-red-400">
                          -{formatMoney(sal.esiEmployee)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ESI (er): </span>
                        <span className="font-mono text-muted-foreground">
                          {formatMoney(sal.esiEmployer)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">
                          Net Salary:{" "}
                        </span>
                        <span className="font-mono text-green-400 font-semibold text-sm">
                          {formatMoney(sal.net)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!paid && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Btn size="sm" variant="secondary">
                            <CreditCard size={13} /> UPI
                          </Btn>
                        </a>
                      )}
                      <Btn
                        size="sm"
                        onClick={() => markPaid(w, sal.net, sal)}
                      >
                        <CheckCircle size={13} /> Mark Paid
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {workers.length === 0 && (
            <p className="text-muted-foreground text-sm py-4">
              No approved workers.
            </p>
          )}
        </div>
      </div>

      {managers.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Managers — Fixed Salary
          </h2>
          <div className="space-y-3">
            {managers.map((m) => {
              const paid = isPaid(m.id);
              const link = upiLink(m, m.monthlySalary ?? 0);
              return (
                <div
                  key={m.id}
                  className={`bg-card border rounded-xl p-4 transition-colors ${
                    paid
                      ? "border-green-500/20 bg-green-950/10"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {m.name}
                        </span>
                        {paid && <Badge variant="success">Paid</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Fixed Salary:{" "}
                        <span className="font-mono text-green-400 font-semibold">
                          {formatMoney(m.monthlySalary ?? 0)}
                        </span>
                        {m.upi && (
                          <span className="text-xs ml-2">· UPI: {m.upi}</span>
                        )}
                      </p>
                    </div>
                    {!paid && (
                      <div className="flex items-center gap-2">
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Btn size="sm" variant="secondary">
                              <CreditCard size={13} /> UPI
                            </Btn>
                          </a>
                        )}
                        <Btn
                          size="sm"
                          onClick={() => markPaid(m, m.monthlySalary ?? 0)}
                        >
                          <CheckCircle size={13} /> Mark Paid
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
