import { CalendarDays, Clock3, Users } from "lucide-react";
import {
  type AttendanceRecord,
  currentMonth,
  formatMoney,
  formatMonth,
} from "../../lib/payroll";
import { SectionTag, StatCard } from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function AttendanceView({ db, update, user }: ViewProps) {
  const month = currentMonth();
  const isOwner = user.role === "owner";
  const workers = db.users.filter(
    (u) => u.role === "worker" && u.status === "approved"
  );
  const totals = workers.reduce(
    (result, worker) => {
      const attendance = db.attendance[worker.id]?.[month] ?? { present: 0, otHours: 0 };
      result.days += attendance.present;
      result.ot += attendance.otHours;
      return result;
    },
    { days: 0, ot: 0 }
  );

  function getAtt(userId: string): AttendanceRecord {
    return db.attendance[userId]?.[month] ?? { present: 0, otHours: 0 };
  }

  function setAtt(
    userId: string,
    field: keyof AttendanceRecord,
    value: number
  ) {
    const att = { ...db.attendance };
    if (!att[userId]) att[userId] = {};
    att[userId] = {
      ...att[userId],
      [month]: { ...getAtt(userId), [field]: Math.max(0, value) },
    };
    update({ ...db, attendance: att });
  }

  return (
    <div className="space-y-7">
      <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Attendance &amp; overtime
          </h1>
        <p className="text-sm text-muted-foreground">
          {formatMonth(month)} &mdash;{" "}
          {isOwner
            ? "View only — OT rates managed in Workers → OT Rates"
            : "Enter present days and OT hours for each worker"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Approved workers" value={String(workers.length)} sub="Active workforce" icon={Users} color="#13776e" />
        <StatCard label="Days recorded" value={String(totals.days)} sub={formatMonth(month)} icon={CalendarDays} color="#5279a5" />
        <StatCard label="Overtime hours" value={String(totals.ot)} sub="Recorded this month" icon={Clock3} color="#bf6a42" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="border-b border-border">
              {[
                "Worker",
                "Section",
                "Pay Type",
                "Present Days",
                "OT Hours",
                "OT Rate",
                "Live Earnings",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium ${
                    i > 2 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w, i) => {
              const att = getAtt(w.id);
              const pieces = db.submissions
                .filter((s) => s.userId === w.id && s.month === month)
                .reduce((s, x) => s + x.pieces, 0);
              const base =
                w.payType === "daily"
                  ? att.present * (w.dailyRate ?? 0)
                  : pieces * (db.pieceRates[w.section!] ?? 0);
              const ot =
                att.otHours * (w.hourlyOT ?? 0) * db.settings.otMultiplier;
              return (
                <tr
                  key={w.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                    i % 2 === 1 ? "bg-muted/10" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.mobile}</p>
                  </td>
                  <td className="px-4 py-3">
                    {w.section ? (
                      <SectionTag section={w.section} label={db.sections.find((section) => section.code === w.section)?.name} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize text-xs">
                    {w.payType}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {w.payType === "piece" ? (
                      <span className="text-xs text-muted-foreground font-mono">
                        {pieces} pcs
                      </span>
                    ) : (
                      <input
                        aria-label={`Present days for ${w.name}`}
                        type="number"
                        min="0"
                        max="31"
                        value={att.present}
                        onChange={(e) =>
                          setAtt(w.id, "present", parseInt(e.target.value) || 0)
                        }
                        className="w-16 px-2 py-1.5 bg-muted border border-border rounded text-sm font-mono text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      aria-label={`Overtime hours for ${w.name}`}
                      type="number"
                      min="0"
                      step="0.5"
                      value={att.otHours}
                      onChange={(e) =>
                        setAtt(
                          w.id,
                          "otHours",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-16 px-2 py-1.5 bg-muted border border-border rounded text-sm font-mono text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs text-muted-foreground">
                      ₹{w.hourlyOT ?? 0}/hr
                    </span>
                    <p className="text-xs text-muted-foreground">
                      ×{db.settings.otMultiplier}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono text-foreground">
                      {formatMoney(base + ot)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Wages {formatMoney(base)} + OT {formatMoney(ot)}
                    </p>
                  </td>
                </tr>
              );
            })}
            {workers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground text-sm"
                >
                  No approved workers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground text-sm mb-1">
          How earnings are calculated
        </p>
        <p>
          Piece worker:{" "}
          <span className="text-foreground">Total Pieces × Piece Rate</span>
        </p>
        <p>
          Daily worker:{" "}
          <span className="text-foreground">Present Days × Daily Rate</span>
        </p>
        <p>
          OT:{" "}
          <span className="text-foreground">
            OT Hours × Hourly Rate × {db.settings.otMultiplier}× multiplier
          </span>
        </p>
      </div>
    </div>
  );
}
