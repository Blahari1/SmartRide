import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { homePathFor, useAuth } from "../../context/authStore";
import * as auth from "../../services/authService";
import { Alert, Button, Field } from "../../components/ui";
import { inputClass } from "../../lib/format";
import AuthLayout from "./AuthLayout";

const validate = (f) => {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Enter your full name";
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email address";
  if (f.phone && !/^[0-9+\-\s]{7,20}$/.test(f.phone)) e.phone = "Enter 7 to 20 digits";
  if (f.password.length < 8) e.password = "Use at least 8 characters";
  if (f.password !== f.confirm) e.confirm = "Passwords do not match";
  return e;
};

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ accountType: "customer", name: "", email: "", phone: "", password: "", confirm: "" });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  const errors = validate(form);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    setBusy(true); setError("");
    try {
      await auth.register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password, accountType: form.accountType });
      const u = await login(form.email.trim(), form.password);
      navigate(u.role === "driver" ? "/driver/profile/edit" : "/customer/profile/edit", { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const show = (k) => (touched ? errors[k] : undefined);

  return (
    <AuthLayout title="Create your account" subtitle="Choose how you will use SmartRide." footer={<>Already registered? <Link className="font-semibold text-blue-700 hover:underline" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <fieldset className="grid grid-cols-2 gap-2" aria-label="Account type">
          {[["customer", "I need rides"], ["driver", "I am a driver"]].map(([v, l]) => (
            <label key={v} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-semibold ${form.accountType === v ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-600"}`}>
              <input type="radio" name="accountType" className="sr-only" checked={form.accountType === v} onChange={() => setForm({ ...form, accountType: v })} />{l}
            </label>
          ))}
        </fieldset>
        <Field label="Full name" error={show("name")}><input className={inputClass} autoComplete="name" value={form.name} onChange={set("name")} /></Field>
        <Field label="Email" error={show("email")}><input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone (optional)" error={show("phone")}><input className={inputClass} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Password" error={show("password")} hint="8 to 72 characters"><input className={inputClass} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
        <Field label="Confirm password" error={show("confirm")}><input className={inputClass} type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} /></Field>
        <Button type="submit" busy={busy} className="w-full">Create account</Button>
        {form.accountType === "driver" && <p className="text-xs text-slate-500">Driver accounts must submit licence details and be verified by an administrator before receiving customers.</p>}
      </form>
    </AuthLayout>
  );
}
