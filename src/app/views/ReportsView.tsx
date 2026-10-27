import { useState, useMemo } from "react";
import { Printer } from "lucide-react";
import {
  SECTIONS,
  SECTION_NAMES,
  SECTION_COLORS,
  calcSalaries,
  currentMonth,
  formatMoney,
  formatMonth,
  getMonthOptions,
} from "../../lib/payroll";
import { Btn, Sel } from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function ReportsView({ db, update }: ViewProps) {
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<"salary" | "order" | "pfesi" | "attendance">(
    "salary"
  );
  const salaries = useMemo(() => calcSalaries(month, db), [month, db]);
  const workers = db.users.filter(
    (u) => u.role === "worker" && u.status === "approved"
  );

  const tabCls = (t: string) =>
    `px-4 py-1.5 rounded-md text-sm transition-all cursor-pointer ${
      tab === t
        ? "bg-card text-foreground shadow-sm font-medium"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const thCls =
    "px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium";
  const thRCls =
    "px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium";
  const tdCls = "px-4 py-3";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl text-foreground font-normal"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">Printable summaries</p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value={month} onChange={(e) => setMonth(e.target.value)}>
            {getMonthOptions().map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </Sel>
          <Btn size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </Btn>
        </div>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        <button onClick={() => setTab("salary")} className={tabCls("salary")}>
          Salary
        </button>
        <button onClick={() => setTab("order")} className={tabCls("order")}>
          Orders
        </button>
        <button onClick={() => setTab("pfesi")} className={tabCls("pfesi")}>
          PF &amp; ESI
        </button>
        <button
          onClick={() => setTab("attendance")}
          className={tabCls("attendance")}
        >
          Attendance
        </button>
      </div>

      {tab === "salary" && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-medium text-foreground">
              Salary Summary &mdash; {formatMonth(month)}
            </h3>
          </div>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={thCls}>Worker</th>
                <th className={thRCls}>Gross</th>
                <th className={thRCls}>OT</th>
                <th className={thRCls}>Pool Share</th>
                <th className={thRCls}>Deductions</th>
                <th className={thRCls}>Net Salary</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => {
                const s = salaries.get(w.id);
                if (!s) return null;
                return (
                  <tr
                    key={w.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/10 ${
                      i % 2 === 1 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className={tdCls}>
                      <p className="font-medium text-foreground">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.section} · {w.payType}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatMoney(s.gross)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatMoney(s.ot)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {formatMoney(s.finalPay)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      -{formatMoney(s.pf + s.esiEmployee)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-400 font-semibold">
                      {formatMoney(s.net)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-medium border-t-2 border-border">
                <td className="px-4 py-3 text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatMoney(
                    Array.from(salaries.values()).reduce(
                      (s, v) => s + v.gross,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatMoney(
                    Array.from(salaries.values()).reduce(
                      (s, v) => s + v.ot,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">
                  {formatMoney(
                    Array.from(salaries.values()).reduce(
                      (s, v) => s + v.finalPay,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-400">
                  -
                  {formatMoney(
                    Array.from(salaries.values()).reduce(
                      (s, v) => s + v.pf + v.esiEmployee,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-green-400 font-semibold">
                  {formatMoney(
                    Array.from(salaries.values()).reduce(
                      (s, v) => s + v.net,
                      0
                    )
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "order" && (
        <div className="space-y-4">
          {db.orders.map((order) => (
            <div
              key={order.id}
              className="bg-card border border-border rounded-xl overflow-x-auto"
            >
              <div className="px-5 py-4 border-b border-border flex flex-wrap justify-between gap-2">
                <h3 className="font-medium text-foreground">{order.name}</h3>
                <span className="text-xs text-muted-foreground">
                  Target: {order.target} · Rev: {formatMoney(order.revenue)} ·
                  Cost: {formatMoney(order.costs)}
                </span>
              </div>
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className={thCls}>Stage</th>
                    <th className={thRCls}>Approved</th>
                    <th className={thRCls}>Target %</th>
                    <th className={thRCls}>Workers</th>
                    <th className={thRCls}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((s, i) => {
                    const count = order.stages[s];
                    const pct =
                      order.target > 0
                        ? Math.round((count / order.target) * 100)
                        : 0;
                    const sw = workers.filter((w) => w.section === s).length;
                    const sub = db.submissions
                      .filter(
                        (x) => x.orderId === order.id && x.section === s
                      )
                      .reduce((a, b) => a + b.pieces, 0);
                    return (
                      <tr
                        key={s}
                        className={`border-b border-border last:border-0 ${
                          i % 2 === 1 ? "bg-muted/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded mr-2"
                            style={{
                              backgroundColor: SECTION_COLORS[s].bg,
                              color: SECTION_COLORS[s].text,
                            }}
                          >
                            {s}
                          </span>
                          {SECTION_NAMES[s]}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {count}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {pct}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {sw}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {sub}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === "pfesi" && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-medium text-foreground">
              PF &amp; ESI Eligibility &mdash; {formatMonth(month)}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toggle PF / ESI per worker. PF: 12% of gross (capped ₹15,000).
              ESI: 0.75% emp + 3.25% er if gross ≤ ₹21,000.
            </p>
          </div>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={thCls}>Worker</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  PF
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  ESI
                </th>
                <th className={thRCls}>Gross</th>
                <th className={thRCls}>PF (12%)</th>
                <th className={thRCls}>ESI Emp (0.75%)</th>
                <th className={thRCls}>ESI Er (3.25%)</th>
                <th className={thRCls}>Total Deduction</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => {
                const s = salaries.get(w.id);
                if (!s) return null;
                const pfOn = w.pfEnabled !== false;
                const esiOn = w.esiEnabled !== false;
                const togglePF = () => {
                  const updated = db.users.map((u) =>
                    u.id === w.id ? { ...u, pfEnabled: !pfOn } : u
                  );
                  update({ ...db, users: updated });
                };
                const toggleESI = () => {
                  const updated = db.users.map((u) =>
                    u.id === w.id ? { ...u, esiEnabled: !esiOn } : u
                  );
                  update({ ...db, users: updated });
                };
                return (
                  <tr
                    key={w.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/10 ${
                      i % 2 === 1 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className={tdCls}>
                      <p className="font-medium text-foreground">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Gross: {formatMoney(s.gross)} ·{" "}
                        {s.gross <= 21000
                          ? "ESI wage-eligible"
                          : "Above ESI wage limit"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={togglePF}
                        title={
                          pfOn
                            ? "Disable PF for this worker"
                            : "Enable PF for this worker"
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 cursor-pointer ${
                          pfOn ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            pfOn ? "translate-x-[18px]" : "translate-x-[2px]"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={toggleESI}
                        title={
                          esiOn
                            ? "Disable ESI for this worker"
                            : "Enable ESI for this worker"
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 cursor-pointer ${
                          esiOn ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            esiOn ? "translate-x-[18px]" : "translate-x-[2px]"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatMoney(s.gross)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        pfOn
                          ? "text-red-400"
                          : "text-muted-foreground line-through"
                      }`}
                    >
                      {formatMoney(s.pf)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        esiOn
                          ? "text-red-400"
                          : "text-muted-foreground line-through"
                      }`}
                    >
                      {formatMoney(s.esiEmployee)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        esiOn
                          ? "text-amber-400"
                          : "text-muted-foreground line-through"
                      }`}
                    >
                      {formatMoney(s.esiEmployer)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400 font-semibold">
                      {formatMoney(s.pf + s.esiEmployee)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "attendance" && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-medium text-foreground">
              Attendance Summary &mdash; {formatMonth(month)}
            </h3>
          </div>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={thCls}>Worker</th>
                <th className={thCls}>Section</th>
                <th className={thRCls}>Present Days</th>
                <th className={thRCls}>OT Hours</th>
                <th className={thRCls}>Total Pieces</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => {
                const att =
                  db.attendance[w.id]?.[month] ?? { present: 0, otHours: 0 };
                const pieces = db.submissions
                  .filter((s) => s.userId === w.id && s.month === month)
                  .reduce((s, x) => s + x.pieces, 0);
                return (
                  <tr
                    key={w.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/10 ${
                      i % 2 === 1 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {w.name}
                    </td>
                    <td className="px-4 py-3">
                      {w.section && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: SECTION_COLORS[w.section].bg,
                            color: SECTION_COLORS[w.section].text,
                          }}
                        >
                          {w.section}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {att.present}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {att.otHours}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {pieces}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
