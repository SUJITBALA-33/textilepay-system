import { useState } from "react";
import {
  Plus,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import {
  type Section,
  type PayType,
  type Status,
  type User,
  SECTIONS,
  SECTION_NAMES,
  SECTION_COLORS,
  formatMoney,
} from "../../lib/payroll";
import {
  Badge,
  Btn,
  Inp,
  Modal,
  SectionTag,
  Sel,
  StatusBadge,
} from "../components/ui-primitives";
import { CreateAccountForm } from "./CreateAccountForm";
import { type ViewProps } from "./DashboardView";

export function WorkersView({
  db,
  update,
  user,
  toast,
  createAccount,
}: ViewProps) {
  const [tab, setTab] = useState<"pending" | "workers" | "managers" | "rates" | "ot">(
    "pending"
  );
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [approveTarget, setApproveTarget] = useState<User | null>(null);
  const [approveForm, setApproveForm] = useState({
    section: "S1" as Section,
    payType: "piece" as PayType,
    dailyRate: "500",
    hourlyOT: "80",
    workDays: "26",
    monthlySalary: "35000",
  });
  const [ratesForm, setRatesForm] = useState({ ...db.pieceRates });
  const approvedWorkers = db.users.filter(
    (u) => u.role === "worker" && u.status === "approved"
  );
  const [otRatesForm, setOtRatesForm] = useState<Record<string, string>>(
    Object.fromEntries(
      approvedWorkers.map((w) => [w.id, String(w.hourlyOT ?? 80)])
    )
  );
  const [otMultiplierForm, setOtMultiplierForm] = useState(
    String(db.settings.otMultiplier)
  );

  const pending = db.users.filter((u) => u.status === "pending");
  const workers = db.users.filter(
    (u) => u.role === "worker" && u.status !== "rejected"
  );
  const managers = db.users.filter(
    (u) => u.role === "manager" && u.status !== "rejected"
  );

  function openApprove(u: User) {
    setApproveTarget(u);
    setApproveForm((f) => ({
      ...f,
      section: u.section ?? "S1",
      payType: u.payType ?? "piece",
      dailyRate: String(u.dailyRate ?? 500),
      hourlyOT: String(u.hourlyOT ?? 80),
    }));
  }

  function confirmApprove() {
    if (!approveTarget) return;
    const updated = db.users.map((u) => {
      if (u.id !== approveTarget.id) return u;
      const base = { ...u, status: "approved" as Status };
      if (u.role === "worker") {
        return {
          ...base,
          section: approveForm.section,
          payType: approveForm.payType,
          dailyRate: parseFloat(approveForm.dailyRate) || 0,
          hourlyOT: parseFloat(approveForm.hourlyOT) || 0,
          workDays: parseInt(approveForm.workDays) || 26,
        };
      }
      return {
        ...base,
        monthlySalary: parseFloat(approveForm.monthlySalary) || 0,
      };
    });
    update({ ...db, users: updated });
    toast.success(`${approveTarget.name} approved`);
    setApproveTarget(null);
  }

  function rejectUser(id: string) {
    if (!confirm("Reject this user?")) return;
    update({
      ...db,
      users: db.users.map((u) =>
        u.id === id ? { ...u, status: "rejected" as Status } : u
      ),
    });
    toast.info("User rejected");
  }

  function toggleStatus(id: string, curr: Status) {
    const next: Status = curr === "deactivated" ? "approved" : "deactivated";
    update({
      ...db,
      users: db.users.map((u) => (u.id === id ? { ...u, status: next } : u)),
    });
    toast.info(
      next === "deactivated" ? "Worker deactivated" : "Worker reactivated"
    );
  }

  function deleteUser(id: string) {
    if (!confirm("Permanently delete this user?")) return;
    update({ ...db, users: db.users.filter((u) => u.id !== id) });
    toast.info("User deleted");
  }

  function saveRates() {
    update({ ...db, pieceRates: ratesForm });
    toast.success("Piece rates updated");
  }

  function saveOtRates() {
    const updatedUsers = db.users.map((u) => {
      const val = otRatesForm[u.id];
      if (val === undefined) return u;
      return { ...u, hourlyOT: parseFloat(val) || 0 };
    });
    const newMultiplier = parseFloat(otMultiplierForm) || 1;
    update({
      ...db,
      users: updatedUsers,
      settings: { ...db.settings, otMultiplier: newMultiplier },
    });
    toast.success("OT rates updated");
  }

  const tabCls = (t: string) =>
    `px-4 py-1.5 rounded-md text-sm transition-all capitalize cursor-pointer ${
      tab === t
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-2xl text-foreground font-normal"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Workers &amp; Rates
          </h1>
          <p className="text-sm text-muted-foreground">
            Create accounts, approve access, and manage payroll rates.
          </p>
        </div>
        <Btn size="sm" onClick={() => setShowCreateAccount(true)}>
          <Plus size={13} /> Create Account
        </Btn>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {(["pending", "workers", "managers", "rates", "ot"] as const).map(
          (t) => (
            <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
              {t === "ot" ? "OT Rates" : t}
              {t === "pending" && pending.length > 0 && (
                <span className="ml-1.5 text-xs bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-semibold">
                  {pending.length}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No pending approvals — all clear.
            </p>
          ) : (
            pending.map((u) => (
              <div
                key={u.id}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {u.name}
                      </span>
                      <Badge variant="warning">{u.role}</Badge>
                      {u.section && <SectionTag section={u.section} />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>📱 {u.mobile}</span>
                      <span>📅 DOB: {u.dob || "—"}</span>
                      <span className="sm:col-span-2">
                        📍 {u.address || "—"}
                      </span>
                      <span className="sm:col-span-2">
                        🏦 {u.bankDetails || "—"}
                      </span>
                      {u.upi && <span>💳 {u.upi}</span>}
                      {u.aadhaar && <span>🪪 {u.aadhaar}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn size="sm" onClick={() => openApprove(u)}>
                      <CheckCircle size={13} /> Approve
                    </Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={() => rejectUser(u.id)}
                    >
                      <XCircle size={13} /> Reject
                    </Btn>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "workers" && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                {["Worker", "Section", "Pay Type", "Rate", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium ${
                        h === "Actions" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => (
                <tr
                  key={w.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
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
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {w.payType ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground text-xs">
                    {w.payType === "daily"
                      ? `₹${w.dailyRate}/day`
                      : w.section
                      ? `₹${db.pieceRates[w.section]}/pc`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStatus(w.id, w.status)}
                      >
                        {w.status === "deactivated" ? "Activate" : "Deactivate"}
                      </Btn>
                      <button
                        onClick={() => deleteUser(w.id)}
                        className="p-1.5 rounded hover:bg-red-900/30 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete worker"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground text-sm"
                  >
                    No workers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "managers" && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Manager",
                  "Mobile",
                  "Monthly Salary",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium ${
                      h === "Actions" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                    i % 2 === 1 ? "bg-muted/10" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.upi || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.mobile}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {formatMoney(m.monthlySalary ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(m.id)}
                      className="p-1.5 rounded hover:bg-red-900/30 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete manager"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground text-sm"
                  >
                    No managers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rates" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium text-foreground mb-1">
            Piece Rate per Section
          </h3>
          <p className="text-xs text-muted-foreground mb-5">
            Amount paid per piece processed in each section.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            {SECTIONS.map((s) => (
              <div key={s} className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: SECTION_COLORS[s].bg,
                      color: SECTION_COLORS[s].text,
                    }}
                  >
                    {s}
                  </span>
                  {SECTION_NAMES[s]}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={ratesForm[s]}
                    onChange={(e) =>
                      setRatesForm((f) => ({
                        ...f,
                        [s]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-7 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>
          <Btn onClick={saveRates}>
            <CheckCircle size={13} /> Save Rates
          </Btn>
        </div>
      )}

      {tab === "ot" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-medium text-foreground mb-1">OT Multiplier</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Applied globally to all workers. OT Pay = Hours × Hourly Rate ×
              Multiplier.
            </p>
            <div className="flex items-end gap-4">
              <div className="w-40">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Multiplier (×)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={otMultiplierForm}
                  onChange={(e) => setOtMultiplierForm(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground pb-2.5">
                e.g. 1.5× means every OT hour is worth 1.5 regular hours
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-medium text-foreground">
                Hourly OT Rate per Worker
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the ₹/hour OT rate for each worker. Manager logs actual OT
                hours in Attendance.
              </p>
            </div>
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pay Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    OT Rate (₹/hr)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Effective Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {approvedWorkers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground text-sm"
                    >
                      No approved workers yet.
                    </td>
                  </tr>
                )}
                {approvedWorkers.map((w, i) => {
                  const rate =
                    parseFloat(
                      otRatesForm[w.id] ?? String(w.hourlyOT ?? 80)
                    ) || 0;
                  const mult = parseFloat(otMultiplierForm) || 1;
                  return (
                    <tr
                      key={w.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/10 ${
                        i % 2 === 1 ? "bg-muted/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{w.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.mobile}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {w.section ? (
                          <SectionTag section={w.section} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {w.payType}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-muted-foreground">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={
                              otRatesForm[w.id] ?? String(w.hourlyOT ?? 80)
                            }
                            onChange={(e) =>
                              setOtRatesForm((f) => ({
                                ...f,
                                [w.id]: e.target.value,
                              }))
                            }
                            className="w-20 px-2 py-1.5 bg-muted border border-border rounded text-sm font-mono text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400 text-xs">
                        ₹{(rate * mult).toFixed(0)}/hr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Btn onClick={saveOtRates}>
            <CheckCircle size={13} /> Save OT Rates
          </Btn>
        </div>
      )}

      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={approveTarget ? `Approve ${approveTarget.name}` : "Approve"}
      >
        {approveTarget?.role === "worker" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Sel
                label="Section"
                value={approveForm.section}
                onChange={(e) =>
                  setApproveForm((f) => ({
                    ...f,
                    section: e.target.value as Section,
                  }))
                }
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} — {SECTION_NAMES[s]}
                  </option>
                ))}
              </Sel>
              <Sel
                label="Pay Type"
                value={approveForm.payType}
                onChange={(e) =>
                  setApproveForm((f) => ({
                    ...f,
                    payType: e.target.value as PayType,
                  }))
                }
              >
                <option value="piece">Piece Rate</option>
                <option value="daily">Daily Rate</option>
              </Sel>
              <Inp
                label="Daily Rate (₹)"
                type="number"
                value={approveForm.dailyRate}
                onChange={(e) =>
                  setApproveForm((f) => ({ ...f, dailyRate: e.target.value }))
                }
              />
              <Inp
                label="Hourly OT (₹)"
                type="number"
                value={approveForm.hourlyOT}
                onChange={(e) =>
                  setApproveForm((f) => ({ ...f, hourlyOT: e.target.value }))
                }
              />
              <Inp
                label="Work Days/Month"
                type="number"
                value={approveForm.workDays}
                onChange={(e) =>
                  setApproveForm((f) => ({ ...f, workDays: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={() => setApproveTarget(null)}>
                Cancel
              </Btn>
              <Btn onClick={confirmApprove}>
                <CheckCircle size={13} /> Approve Worker
              </Btn>
            </div>
          </div>
        ) : approveTarget?.role === "manager" ? (
          <div className="flex flex-col gap-4">
            <Inp
              label="Monthly Salary (₹)"
              type="number"
              value={approveForm.monthlySalary}
              onChange={(e) =>
                setApproveForm((f) => ({
                  ...f,
                  monthlySalary: e.target.value,
                }))
              }
            />
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setApproveTarget(null)}>
                Cancel
              </Btn>
              <Btn onClick={confirmApprove}>
                <CheckCircle size={13} /> Approve Manager
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
        title="Create Staff Account"
        size="lg"
      >
        <CreateAccountForm
          creatorRole={user.role}
          onCreate={createAccount}
          onDone={() => setShowCreateAccount(false)}
          toast={toast}
        />
      </Modal>
    </div>
  );
}
