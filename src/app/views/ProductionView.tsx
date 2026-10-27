import { useState, useEffect } from "react";
import { Edit2, CheckCircle, AlertTriangle } from "lucide-react";
import {
  type Section,
  sectionColor,
  updateOrderStage,
} from "../../lib/payroll";
import {
  Badge,
  Btn,
  ProgressBar,
  Sel,
} from "../components/ui-primitives";
import { type ViewProps } from "./DashboardView";

export function ProductionView({ db, update, toast }: ViewProps) {
  const sections = db.sections.filter((section) => section.active).sort((a, b) => a.position - b.position);
  const pipeline = sections.map((section) => section.code);
  const [selectedOrderId, setSelectedOrderId] = useState(
    db.orders[0]?.id ?? ""
  );
  const [editing, setEditing] = useState<Record<Section, string>>({});
  const [editMode, setEditMode] = useState(false);

  const order = db.orders.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (order) {
      setEditing(
        Object.fromEntries(
          pipeline.map((s) => [s, String(order.stages[s] ?? 0)])
        ) as Record<Section, string>
      );
    }
  }, [selectedOrderId, order, db.sections]);

  function saveStages() {
    if (!order) return;
    let updated = { ...order };
    for (const s of pipeline) {
      updated = updateOrderStage(updated, s, parseInt(editing[s]) || 0, pipeline);
    }
    const orders = db.orders.map((o) => (o.id === updated.id ? updated : o));
    update({ ...db, orders });
    toast.success("Production numbers updated");
    setEditMode(false);
    setEditing(
      Object.fromEntries(
        pipeline.map((s) => [s, String(updated.stages[s] ?? 0)])
      ) as Record<Section, string>
    );
  }

  function cancelEdit() {
    if (order)
      setEditing(
        Object.fromEntries(
          pipeline.map((s) => [s, String(order.stages[s] ?? 0)])
        ) as Record<Section, string>
      );
    setEditMode(false);
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Production flow
          </h1>
          <p className="text-sm text-muted-foreground">
            Track output across this company’s production stages.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {db.orders.length > 0 && (
            <Sel
              label="Choose order"
              value={selectedOrderId}
              onChange={(e) => {
                setSelectedOrderId(e.target.value);
                setEditMode(false);
              }}
            >
              {db.orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Sel>
          )}
          {!editMode ? (
            <Btn size="sm" onClick={() => setEditMode(true)}>
              <Edit2 size={13} /> Edit Stages
            </Btn>
          ) : (
            <>
              <Btn size="sm" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Btn>
              <Btn size="sm" onClick={saveStages}>
                <CheckCircle size={13} /> Save
              </Btn>
            </>
          )}
        </div>
      </div>

      {db.orders.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          No orders found. The owner must create orders first.
        </div>
      )}

      {order && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div>
                <h3 className="font-medium text-foreground">{order.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Target: {order.target} pcs
                </p>
              </div>
              <Badge variant={order.status === "active" ? "success" : "info"}>
                {order.status}
              </Badge>
            </div>

            <div className="space-y-4">
              {sections.map((sectionConfig, idx) => {
                const section = sectionConfig.code;
                const count = order.stages[section] ?? 0;
                const prevCount =
                  idx === 0 ? order.target : order.stages[pipeline[idx - 1]] ?? 0;
                const shortage = Math.max(0, prevCount - count);
                const sectionWorkers = db.users.filter(
                  (u) =>
                    u.role === "worker" &&
                    u.status === "approved" &&
                    u.section === section
                );
                const submitted = db.submissions
                  .filter(
                    (s) => s.orderId === order.id && s.section === section
                  )
                  .reduce((s, x) => s + x.pieces, 0);
                const color = sectionColor(section).text;

                return (
                  <div key={section}>
                    <div className="flex items-center gap-3">
                      <span
                        className="w-20 text-xs font-medium flex-shrink-0"
                        style={{ color }}
                      >
                        {sectionConfig.name}
                      </span>
                      {editMode ? (
                        <input
                          type="number"
                          min="0"
                          max={prevCount}
                          value={editing[section]}
                          onChange={(e) =>
                            setEditing((f) => ({
                              ...f,
                              [section]: e.target.value,
                            }))
                          }
                          className="w-20 px-2 py-1.5 bg-muted border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-shrink-0"
                        />
                      ) : (
                        <span className="w-20 font-mono text-sm text-foreground flex-shrink-0">
                          {count}
                        </span>
                      )}
                      <div className="flex-1">
                        <ProgressBar
                          value={count}
                          max={order.target}
                          color={color}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-8 text-right flex-shrink-0">
                        {order.target > 0
                          ? Math.round((count / order.target) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 ml-[6.5rem] text-xs text-muted-foreground flex-wrap">
                      <span>
                        {sectionWorkers.length} worker
                        {sectionWorkers.length !== 1 ? "s" : ""}
                      </span>
                      <span>Submitted: {submitted}</span>
                      <span>
                        Remaining: {Math.max(0, count - submitted)}
                      </span>
                      {shortage > 20 && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={11} /> {shortage} short from
                          prev. stage
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {editMode && (
            <div className="bg-amber-900/15 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 flex items-center gap-2">
              <AlertTriangle size={14} />
              Each stage is capped at the previous stage. Later stages auto-cap when an earlier stage is reduced.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sections.map((sectionConfig) => {
              const section = sectionConfig.code;
              const sw = db.users.filter(
                (u) =>
                  u.role === "worker" &&
                  u.status === "approved" &&
                  u.section === section
              );
              const total = db.submissions
                .filter((s) => s.orderId === order.id && s.section === section)
                .reduce((s, x) => s + x.pieces, 0);
              const cap = order.stages[section] ?? 0;
              return (
                <div
                  key={section}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: sectionColor(section).bg,
                        color: sectionColor(section).text,
                      }}
                    >
                      {section}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {sectionConfig.name}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground mb-3">
                    <p>
                      Approved:{" "}
                      <span className="text-foreground font-mono">{cap}</span>
                    </p>
                    <p>
                      Submitted:{" "}
                      <span className="text-foreground font-mono">{total}</span>
                    </p>
                    <p>
                      Remaining:{" "}
                      <span className="text-foreground font-mono">
                        {Math.max(0, cap - total)}
                      </span>
                    </p>
                  </div>
                  {sw.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sw.map((w) => (
                        <span
                          key={w.id}
                          className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                        >
                          {w.name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
