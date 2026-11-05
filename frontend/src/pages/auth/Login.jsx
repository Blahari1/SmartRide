import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { homePathFor, useAuth } from "../../context/authStore";
import { Alert, Button, Field } from "../../components/ui";
import { inputClass } from "../../lib/format";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice] = useState(() => { const n = sessionStorage.getItem("smartride:notice"); sessionStorage.removeItem("smartride:notice"); return n; });
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await login(form.email.trim(), form.password);
      const from = location.state?.from;
      navigate(from && from.startsWith(`/${u.role}`) ? from : homePathFor(u.role), { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your SmartRide account." footer={<>New to SmartRide? <Link className="font-semibold text-blue-700 hover:underline" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <Alert kind="warning">{notice}</Alert>}
        <Alert>{error}</Alert>
        <Field label="Email"><input className={inputClass} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input className={inputClass} type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Button type="submit" busy={busy} className="w-full" disabled={!form.email || !form.password}>Log in</Button>
      </form>
    </AuthLayout>
  );
}
