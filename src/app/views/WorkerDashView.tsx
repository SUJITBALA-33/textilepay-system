import React, { useState } from "react";
import {
  Package,
  IndianRupee,
  Clock,
  Wallet,
  Plus,
} from "lucide-react";
import {
  type Section,
  type Submission,
  sectionLabel,
  sectionColor,
  calcRemainingCapacity,
  currentMonth,
  formatMoney,
  formatMonth,
  genId,
} from "../../lib/payroll";
import {
  Badge,
  Btn,
  Inp,
  Modal,
  ProgressBar,
  SectionTag,
  StatCard,
} from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function WorkerDashView({ db, update, user, toast }: ViewProps) {
  const month = currentMonth();
  const section = user.section!;
  const att = db.attendance[user.id]?.[month] ?? { present: 0, otHours: 0 };
  const mySubmissions = db.submissions.filter(
    (s) => s.userId === user.id && s.month === month
  );
  const totalPieces = mySubmissions.reduce((s, x) => s + x.pieces, 0);
  const base =
    user.payType === "daily"
      ? att.present * (user.dailyRate ?? 0)
      : totalPieces * (db.pieceRates[section] ?? 0);
  const ot = att.otHours * (user.hourlyOT ?? 0) * db.settings.otMultiplier;

  const [submitTarget, setSubmitTarget] = useState<{
    orderId: string;
    section: Section;
  } | null>(null);
  const [pieces, setPieces] = useState("");
  const [note, setNote] = useState("");
  const workerSectionActive = db.sections.some(
    (configuredSection) => configuredSection.code === section && configuredSection.active,
  );

  function getRemaining(orderId: string): number {
    const o = db.orders.find((x) => x.id === orderId);
    if (!o) return 0;
    return calcRemainingCapacity(o, section, db.submissions);
  }

  function submitPieces(e: React.FormEvent) {
    e.preventDefault();
    if (!submitTarget) return;
    const count = parseInt(pieces);
    if (!count || count <= 0) {
      toast.error("Enter a valid piece count");
      return;
    }
    const remaining = getRemaining(submitTarget.orderId);
    if (count > remaining) {
      toast.error(`Only ${remaining} pieces remaining in this section`);
      return;
    }
    const sub: Submission = {
      id: genId(),
      userId: user.id,
      orderId: submitTarget.orderId,
      section: submitTarget.section,
      pieces: count,
      note,
      timestamp: new Date().toISOString(),
      month,
    };
    update({ ...db, submissions: [...db.submissions, sub] });
    toast.success(
      `Submitted ${count} pieces — earned ${formatMoney(
        count * (db.pieceRates[section] ?? 0)
      )}`
    );
    setSubmitTarget(null);
    setPieces("");
    setNote("");
  }

  const activeOrders = section && workerSectionActive
    ? db.orders.filter((o) => o.status === "active" && (o.stages[section] ?? 0) > 0)
    : [];

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="max-w-full truncate text-xs font-semibold uppercase tracking-[0.16em] text-primary" title={db.company?.name}>{db.company?.name}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Worker workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My work
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">Welcome back, {user.name}.</span>
            {section && <SectionTag section={section} label={sectionLabel(section, db.sections)} />}
            <span className="text-sm text-muted-foreground">
              {formatMonth(month)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <StatCard
          label="Total Pieces"
          value={String(totalPieces)}
          sub="This month"
          icon={Package}
          color="#bf6a42"
        />
        <StatCard
          label="Earned Wages"
          value={formatMoney(base)}
          sub={
            user.payType === "daily"
              ? `${att.present} days × ₹${user.dailyRate}`
              : `${totalPieces} pcs × ₹${db.pieceRates[section]}`
          }
          icon={IndianRupee}
          color="#2e8b57"
        />
        <StatCard
          label="OT Earnings"
          value={formatMoney(ot)}
          sub={`${att.otHours}h × ₹${user.hourlyOT} × ${db.settings.otMultiplier}x`}
          icon={Clock}
          color="#5279a5"
        />
        <StatCard
          label="Gross Earnings"
          value={formatMoney(base + ot)}
          sub="Before pool & deductions"
          icon={Wallet}
          color="#8a6aa8"
        />
      </div>

      {user.payType === "daily" && (
        <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
          Your attendance is marked by the manager. Contact your manager if the
          days look incorrect. Present days this month:{" "}
          <span className="text-foreground font-mono font-medium">
            {att.present}
          </span>
          &nbsp;· OT hours:{" "}
          <span className="text-foreground font-mono font-medium">
            {att.otHours}
          </span>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Active Orders — {section ? sectionLabel(section, db.sections) : ""}
        </h2>
        {activeOrders.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
            {workerSectionActive
              ? "No active orders for your section right now."
              : "Your section is inactive. Contact the owner to assign you to an active section."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((o) => {
              const mySubs = mySubmissions.filter((s) => s.orderId === o.id);
              const myTotal = mySubs.reduce((s, x) => s + x.pieces, 0);
              const remaining = getRemaining(o.id);
              const totalForSection = db.submissions
                .filter((s) => s.orderId === o.id && s.section === section)
                .reduce((s, x) => s + x.pieces, 0);
              const cap = o.stages[section] ?? 0;

              return (
                <div
                  key={o.id}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{o.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Capacity for {sectionLabel(section, db.sections)}: {cap} pcs
                      </p>
                    </div>
                    <Badge variant={remaining > 0 ? "success" : "error"}>
                      {remaining > 0 ? `${remaining} left` : "Full"}
                    </Badge>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>
                        Section total: {totalForSection}/{cap}
                      </span>
                      <span>My total: {myTotal}</span>
                    </div>
                    <ProgressBar
                      value={totalForSection}
                      max={cap}
                      color={
                        section ? sectionColor(section).text : "#d4921a"
                      }
                    />
                  </div>
                  {myTotal > 0 && (
                    <p className="text-xs text-green-400 mb-3">
                      My earnings from this order:{" "}
                      {formatMoney(myTotal * (db.pieceRates[section] ?? 0))}
                    </p>
                  )}
                  {remaining > 0 && (
                    <Btn
                      size="sm"
                      onClick={() => {
                        setSubmitTarget({ orderId: o.id, section });
                        setPieces("");
                        setNote("");
                      }}
                    >
                      <Plus size={13} /> Submit Pieces
                    </Btn>
                  )}
                  {mySubs.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Recent submissions
                      </p>
                      <div className="space-y-1">
                        {mySubs.slice(-3).map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between text-xs text-muted-foreground"
                          >
                            <span>
                              {new Date(s.timestamp).toLocaleDateString(
                                "en-IN"
                              )}{" "}
                              &mdash; {s.note || "No note"}
                            </span>
                            <span className="font-mono text-foreground">
                              {s.pieces} pcs
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!submitTarget}
        onClose={() => setSubmitTarget(null)}
        title="Submit Pieces"
        size="sm"
      >
        {submitTarget && (
          <form onSubmit={submitPieces} className="flex flex-col gap-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                Remaining capacity:{" "}
                <span className="text-foreground font-mono font-medium">
                  {getRemaining(submitTarget.orderId)} pcs
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rate:{" "}
                <span className="font-mono">
                  ₹{db.pieceRates[section]}/piece
                </span>
              </p>
            </div>
            <Inp
              label="Piece Count *"
              type="number"
              min="1"
              max={getRemaining(submitTarget.orderId)}
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              placeholder="How many pieces?"
              required
            />
            {pieces && parseInt(pieces) > 0 && (
              <p className="text-sm text-green-400 font-medium">
                Estimated earning:{" "}
                {formatMoney(
                  parseInt(pieces) * (db.pieceRates[section] ?? 0)
                )}
              </p>
            )}
            <Inp
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Morning batch"
            />
            <div className="flex justify-end gap-2">
              <Btn
                variant="secondary"
                type="button"
                onClick={() => setSubmitTarget(null)}
              >
                Cancel
              </Btn>
              <Btn type="submit">Submit</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
