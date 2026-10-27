import { ClipboardCheck, Factory, Users } from "lucide-react";
import { Badge, ProgressBar, StatCard } from "../components/ui-primitives";
import { CreateAccountForm } from "./CreateAccountForm";
import { type ViewProps } from "./DashboardView";

export function AccountsView({ db, user, createAccount, toast }: ViewProps) {
  const workers = db.users.filter((person) => person.role === "worker");
  const activeWorkers = workers.filter((person) => person.status === "approved");
  const pendingWorkers = workers.filter((person) => person.status === "pending");
  const activeOrders = db.orders.filter((order) => order.status === "active");
  const finalSection = db.sections.filter((section) => section.active).sort((a, b) => a.position - b.position).at(-1);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="max-w-full truncate text-xs font-semibold uppercase tracking-[0.16em] text-primary" title={db.company?.name}>{db.company?.name}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Manager workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Team operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add workers and keep attendance and production moving.</p>
        </div>
        <Badge variant="info">Manager access</Badge>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Approved workers" value={String(activeWorkers.length)} sub="Ready for assigned work" icon={Users} color="#13776e" />
        <StatCard label="Awaiting approval" value={String(pendingWorkers.length)} sub="Owner review required" icon={ClipboardCheck} color="#bf6a42" />
        <StatCard label="Active orders" value={String(activeOrders.length)} sub="Currently in production" icon={Factory} color="#5279a5" />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="surface min-w-0 p-4 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Add a worker</h2>
            <p className="mt-1 text-sm text-muted-foreground">New accounts are sent to the owner for approval.</p>
          </div>
          <CreateAccountForm
            creatorRole={user.role}
            onCreate={createAccount}
            sections={db.sections.filter((section) => section.active)}
            toast={toast}
          />
        </section>

        <aside className="surface h-fit min-w-0 p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Production in progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">Final-stage output against order targets.</p>
            </div>
            <Factory size={19} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
          </div>
          {activeOrders.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-5 text-sm text-muted-foreground">No active orders right now.</p>
          ) : (
            <div className="space-y-5">
              {activeOrders.slice(0, 5).map((order) => {
                const packed = finalSection ? order.stages[finalSection.code] ?? 0 : 0;
                const progress = order.target > 0 ? Math.round((packed / order.target) * 100) : 0;
                return (
                  <div key={order.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">{order.name}</p>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">{progress}%</span>
                    </div>
                    <ProgressBar value={packed} max={order.target} color="#13776e" />
                    <p className="text-xs text-muted-foreground">{packed.toLocaleString()} of {order.target.toLocaleString()} pieces at {finalSection?.name ?? "final stage"}</p>
                  </div>
                );
              })}
            </div>
          )}
          {activeOrders.length > 5 && (
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              Showing 5 of {activeOrders.length} active orders.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
