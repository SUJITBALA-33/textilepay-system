import React, { useState } from "react";
import {
  TrendingUp,
  BarChart2,
  IndianRupee,
  Users,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Bell,
  CheckCircle,
} from "lucide-react";
import {
  type DB,
  type Order,
  type User,
  SECTIONS,
  SECTION_NAMES,
  SECTION_COLORS,
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
  StatCard,
  type ToastFn,
} from "../components/ui-primitives";

export interface ViewProps {
  db: DB;
  update: (db: DB) => void;
  user: User;
  toast: ToastFn;
  createAccount: (form: Record<string, string>) => Promise<void>;
}

export function DashboardView({ db, update, toast }: ViewProps) {
  const month = currentMonth();
  const workers = db.users.filter((u) => u.role === "worker" && u.status === "approved");
  const pending = db.users.filter((u) => u.status === "pending");
  const totalRev = db.orders.reduce((s, o) => s + o.revenue, 0);
  const totalCost = db.orders.reduce((s, o) => s + o.costs, 0);
  const profit = totalRev - totalCost;
  const packedPieces = db.orders.reduce((s, o) => s + (o.stages.S6 || 0), 0);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [orderForm, setOrderForm] = useState({
    name: "",
    target: "",
    revenue: "",
    costs: "",
  });
  const [settingsForm, setSettingsForm] = useState({ ...db.settings });

  function addOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderForm.name || !orderForm.target) {
      toast.error("Name and target required");
      return;
    }
    const newOrder: Order = {
      id: genId(),
      name: orderForm.name,
      target: parseInt(orderForm.target) || 0,
      revenue: parseFloat(orderForm.revenue) || 0,
      costs: parseFloat(orderForm.costs) || 0,
      stages: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    };
    update({ ...db, orders: [...db.orders, newOrder] });
    toast.success("Order created");
    setShowAddOrder(false);
    setOrderForm({ name: "", target: "", revenue: "", costs: "" });
  }

  function saveSettings() {
    update({ ...db, settings: settingsForm });
    toast.success("Settings saved");
    setShowSettings(false);
  }

  function toggleOrderStatus(orderId: string) {
    const orders = db.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: (o.status === "active" ? "completed" : "active") as Order["status"],
          }
        : o
    );
    update({ ...db, orders });
    toast.info("Order status updated");
  }

  function deleteOrder(orderId: string) {
    if (!confirm("Delete this order?")) return;
    update({ ...db, orders: db.orders.filter((o) => o.id !== orderId) });
    toast.info("Order deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl text-foreground font-normal"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatMonth(month)} Overview
          </p>
        </div>
        <div className="flex gap-2">
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => {
              setSettingsForm({ ...db.settings });
              setShowSettings(true);
            }}
          >
            Settings
          </Btn>
          <Btn size="sm" onClick={() => setShowAddOrder(true)}>
            <Plus size={14} /> New Order
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Revenue"
          value={formatMoney(totalRev)}
          sub="All orders"
          icon={TrendingUp}
          color="#4ade80"
        />
        <StatCard
          label="Total Costs"
          value={formatMoney(totalCost)}
          sub="All orders"
          icon={BarChart2}
          color="#f87171"
        />
        <StatCard
          label="Net Profit"
          value={formatMoney(profit)}
          sub={`Pool: ${formatMoney(
            profit * (1 - db.settings.ownerReservePercent / 100)
          )}`}
          icon={IndianRupee}
          color="#d4921a"
        />
        <StatCard
          label="Active Workers"
          value={String(workers.length)}
          sub={`${packedPieces} packed pieces`}
          icon={Users}
          color="#60a5fa"
        />
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-900/15 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-amber-400" />
            <h3 className="text-sm font-medium text-amber-400">
              {pending.length} Pending Approval{pending.length !== 1 ? "s" : ""}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 bg-amber-900/30 border border-amber-500/20 rounded-lg px-3 py-1.5 text-xs text-amber-300"
              >
                <span className="font-medium">{u.name}</span>
                <span className="text-amber-500 capitalize">· {u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Production Orders
        </h2>
        {db.orders.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
            No orders yet. Create your first order.
          </div>
        )}
        <div className="space-y-4">
          {db.orders.map((order) => {
            const shortages = SECTIONS.filter((s, i) => {
              if (i === 0) return order.target - order.stages.S1 > 50;
              return order.stages[SECTIONS[i - 1]] - order.stages[s] > 30;
            });
            return (
              <div
                key={order.id}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-medium text-foreground">{order.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {order.target} pcs &nbsp;·&nbsp; Revenue:{" "}
                      {formatMoney(order.revenue)} &nbsp;·&nbsp; Costs:{" "}
                      {formatMoney(order.costs)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={order.status === "active" ? "success" : "info"}>
                      {order.status}
                    </Badge>
                    <button
                      onClick={() => toggleOrderStatus(order.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                      title="Toggle Order Status"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="p-1 rounded hover:bg-red-900/30 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete Order"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SECTIONS.map((section) => {
                    const count = order.stages[section];
                    const pct =
                      order.target > 0
                        ? Math.round((count / order.target) * 100)
                        : 0;
                    const color = SECTION_COLORS[section].text;
                    return (
                      <div key={section}>
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-xs font-medium"
                            style={{ color }}
                          >
                            {section} {SECTION_NAMES[section]}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {count}/{order.target}
                          </span>
                        </div>
                        <ProgressBar
                          value={count}
                          max={order.target}
                          color={color}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pct}%
                        </p>
                      </div>
                    );
                  })}
                </div>
                {shortages.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} />
                    Stage shortage:{" "}
                    {shortages.map((s) => SECTION_NAMES[s]).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        title="New Production Order"
      >
        <form onSubmit={addOrder} className="flex flex-col gap-4">
          <Inp
            label="Order Name *"
            value={orderForm.name}
            onChange={(e) =>
              setOrderForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="e.g. Winter Collection 2024"
            required
          />
          <Inp
            label="Target Quantity *"
            type="number"
            value={orderForm.target}
            onChange={(e) =>
              setOrderForm((f) => ({ ...f, target: e.target.value }))
            }
            placeholder="Total pieces to produce"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Inp
              label="Revenue (₹)"
              type="number"
              value={orderForm.revenue}
              onChange={(e) =>
                setOrderForm((f) => ({ ...f, revenue: e.target.value }))
              }
              placeholder="0"
            />
            <Inp
              label="Costs (₹)"
              type="number"
              value={orderForm.costs}
              onChange={(e) =>
                setOrderForm((f) => ({ ...f, costs: e.target.value }))
              }
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Btn
              variant="secondary"
              type="button"
              onClick={() => setShowAddOrder(false)}
            >
              Cancel
            </Btn>
            <Btn type="submit">Create Order</Btn>
          </div>
        </form>
      </Modal>

      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="System Settings"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Inp
            label="Owner Reserve %"
            type="number"
            min="0"
            max="100"
            value={String(settingsForm.ownerReservePercent)}
            onChange={(e) =>
              setSettingsForm((f) => ({
                ...f,
                ownerReservePercent: parseFloat(e.target.value) || 0,
              }))
            }
          />
          <Inp
            label="OT Multiplier"
            type="number"
            min="1"
            step="0.1"
            value={String(settingsForm.otMultiplier)}
            onChange={(e) =>
              setSettingsForm((f) => ({
                ...f,
                otMultiplier: parseFloat(e.target.value) || 1,
              }))
            }
          />
          <Inp
            label="Max Hours/Day"
            type="number"
            min="1"
            max="24"
            value={String(settingsForm.maxHours)}
            onChange={(e) =>
              setSettingsForm((f) => ({
                ...f,
                maxHours: parseInt(e.target.value) || 8,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Worker Pool = (Revenue − Costs) × (1 −{" "}
            {settingsForm.ownerReservePercent}%) &nbsp;={" "}
            {formatMoney(
              Math.max(
                0,
                (totalRev - totalCost) *
                  (1 - settingsForm.ownerReservePercent / 100)
              )
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Btn
              variant="secondary"
              type="button"
              onClick={() => setShowSettings(false)}
            >
              Cancel
            </Btn>
            <Btn onClick={saveSettings}>
              <CheckCircle size={13} /> Save
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
