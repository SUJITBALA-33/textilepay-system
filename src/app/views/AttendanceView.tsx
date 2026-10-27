import {
  type AttendanceRecord,
  currentMonth,
  formatMoney,
  formatMonth,
} from "../../lib/payroll";
import { SectionTag } from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function AttendanceView({ db, update, user }: ViewProps) {
  const month = currentMonth();
  const isOwner = user.role === "owner";
  const workers = db.users.filter(
    (u) => u.role === "worker" && u.status === "approved"
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
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl text-foreground font-normal"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Attendance &amp; OT Hours
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatMonth(month)} &mdash;{" "}
          {isOwner
            ? "View only — OT rates managed in Workers → OT Rates"
            : "Enter present days and OT hours for each worker"}
        </p>
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
                      <SectionTag section={w.section} />
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
