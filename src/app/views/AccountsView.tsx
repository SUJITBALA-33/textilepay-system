import { CreateAccountForm } from "./CreateAccountForm";
import { type ViewProps } from "./DashboardView";

export function AccountsView({ user, createAccount, toast }: ViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl text-foreground font-normal"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Add Worker
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a worker login request for owner approval.
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 max-w-2xl">
        <CreateAccountForm
          creatorRole={user.role}
          onCreate={createAccount}
          toast={toast}
        />
      </div>
    </div>
  );
}
