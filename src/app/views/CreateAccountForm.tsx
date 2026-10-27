import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Inp, Sel, Btn, type ToastFn } from "../components/ui-primitives";
import { type Role, SECTIONS, SECTION_NAMES } from "../../lib/payroll";

interface CreateAccountFormProps {
  creatorRole: Role;
  onCreate: (form: Record<string, string>) => Promise<void>;
  onDone?: () => void;
  toast: ToastFn;
}

export function CreateAccountForm({
  creatorRole,
  onCreate,
  onDone,
  toast,
}: CreateAccountFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    username: "",
    password: "",
    address: "",
    aadhaar: "",
    bankDetails: "",
    upi: "",
    emergencyContact: "",
    dob: "",
    joinDate: new Date().toISOString().slice(0, 10),
    role: "worker",
    section: "S1",
    payType: "piece",
  });
  const upd = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name ||
      !form.email ||
      !form.username ||
      !form.password ||
      !form.mobile
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      setSubmitting(true);
      await onCreate({
        ...form,
        role: creatorRole === "manager" ? "worker" : form.role,
      });
      toast.success(
        `${
          form.role === "manager" ? "Manager" : "Worker"
        } account created and sent for owner approval.`
      );
      setForm({
        name: "",
        email: "",
        mobile: "",
        username: "",
        password: "",
        address: "",
        aadhaar: "",
        bankDetails: "",
        upi: "",
        emergencyContact: "",
        dob: "",
        joinDate: new Date().toISOString().slice(0, 10),
        role: "worker",
        section: "S1",
        payType: "piece",
      });
      onDone?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Inp
        label="Full Name *"
        value={form.name}
        onChange={(e) => upd("name", e.target.value)}
        placeholder="Full name"
        required
      />
      <Inp
        label="Email *"
        type="email"
        value={form.email}
        onChange={(e) => upd("email", e.target.value)}
        placeholder="person@company.com"
        autoComplete="off"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Inp
          label="Mobile *"
          value={form.mobile}
          onChange={(e) => upd("mobile", e.target.value)}
          placeholder="10-digit mobile"
          required
        />
        <Inp
          label="Date of Birth"
          type="date"
          value={form.dob}
          onChange={(e) => upd("dob", e.target.value)}
        />
        <Inp
          label="Username *"
          value={form.username}
          onChange={(e) => upd("username", e.target.value)}
          placeholder="Login username"
          required
        />
        <Inp
          label="Temporary Password *"
          type="password"
          value={form.password}
          onChange={(e) => upd("password", e.target.value)}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          required
        />
      </div>
      <Inp
        label="Address"
        value={form.address}
        onChange={(e) => upd("address", e.target.value)}
        placeholder="Full address"
      />
      <div className="grid grid-cols-2 gap-3">
        <Inp
          label="Aadhaar"
          value={form.aadhaar}
          onChange={(e) => upd("aadhaar", e.target.value)}
          placeholder="XXXX XXXX XXXX"
        />
        <Inp
          label="Emergency Contact"
          value={form.emergencyContact}
          onChange={(e) => upd("emergencyContact", e.target.value)}
          placeholder="Contact number"
        />
      </div>
      <Inp
        label="Bank Details"
        value={form.bankDetails}
        onChange={(e) => upd("bankDetails", e.target.value)}
        placeholder="Bank | IFSC | Account No."
      />
      <div className="grid grid-cols-2 gap-3">
        <Inp
          label="UPI ID"
          value={form.upi}
          onChange={(e) => upd("upi", e.target.value)}
          placeholder="person@bank"
        />
        <Inp
          label="Join Date"
          type="date"
          value={form.joinDate}
          onChange={(e) => upd("joinDate", e.target.value)}
        />
      </div>
      {creatorRole === "owner" && (
        <Sel
          label="Account Type"
          value={form.role}
          onChange={(e) => upd("role", e.target.value)}
        >
          <option value="worker">Worker</option>
          <option value="manager">Manager</option>
        </Sel>
      )}
      {(creatorRole === "manager" || form.role === "worker") && (
        <div className="grid grid-cols-2 gap-3">
          <Sel
            label="Section"
            value={form.section}
            onChange={(e) => upd("section", e.target.value)}
          >
            {SECTIONS.map((section) => (
              <option key={section} value={section}>
                {section} — {SECTION_NAMES[section]}
              </option>
            ))}
          </Sel>
          <Sel
            label="Pay Type"
            value={form.payType}
            onChange={(e) => upd("payType", e.target.value)}
          >
            <option value="piece">Piece Rate</option>
            <option value="daily">Daily Rate</option>
          </Sel>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        {onDone && (
          <Btn type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Btn>
        )}
        <Btn type="submit" disabled={submitting}>
          <Plus size={13} /> {submitting ? "Creating…" : "Create Account"}
        </Btn>
      </div>
      <p className="text-xs text-muted-foreground">
        The owner must approve the account before the new user can sign in.
      </p>
    </form>
  );
}
