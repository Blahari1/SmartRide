import { useState } from "react";
import { useAuth } from "../../context/authStore";
import { useAction } from "../../hooks/useAsync";
import { changePassword, updateAccount } from "../../services/authService";
import { Alert, Button, Card, Field, PageHeader } from "../../components/ui";
import { inputClass } from "../../lib/format";

export default function AccountSettings() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const a1 = useAction();
  const a2 = useAction();

  const saveAccount = (e) => {
    e.preventDefault();
    a1.run(async () => { const r = await updateAccount({ name: form.name.trim(), phone: form.phone.trim() || null }); updateUser({ name: r.user.name, phone: r.user.phone }); }, "Account updated.");
  };
  const savePw = (e) => {
    e.preventDefault();
    setPwError("");
    if (pw.newPassword.length < 8) return setPwError("New password must be at least 8 characters.");
    if (pw.newPassword !== pw.confirm) return setPwError("New passwords do not match.");
    a2.run(async () => { await changePassword(pw.currentPassword, pw.newPassword); setPw({ currentPassword: "", newPassword: "", confirm: "" }); }, "Password changed. Use it the next time you log in.");
  };

  return (
    <>
      <PageHeader title="Account settings" subtitle="Your sign-in details and security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account details">
          <form onSubmit={saveAccount} className="space-y-4">
            <Alert>{a1.error}</Alert><Alert kind="success">{a1.success}</Alert>
            <Field label="Email" hint="Email and role cannot be changed."><input className={inputClass} value={user.email} disabled readOnly /></Field>
            <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Button type="submit" busy={a1.busy}>Save changes</Button>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={savePw} className="space-y-4">
            <Alert>{pwError || a2.error}</Alert><Alert kind="success">{a2.success}</Alert>
            <Field label="Current password"><input className={inputClass} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="8 to 72 characters"><input className={inputClass} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Field label="Confirm new password"><input className={inputClass} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            <Button type="submit" busy={a2.busy} disabled={!pw.currentPassword || !pw.newPassword}>Change password</Button>
          </form>
        </Card>
        <Card title="Session" className="lg:col-span-2">
          <p className="text-sm text-slate-600">For your security sessions last 15 minutes and then require a new login. Log out on shared devices.</p>
          <Button className="mt-3" variant="secondary" onClick={() => logout()}>Log out now</Button>
        </Card>
      </div>
    </>
  );
}
