import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-blue-800 p-12 text-white lg:flex">
        <Link to="/login" className="flex items-center gap-2 text-xl font-extrabold"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-800">S</span>SmartRide</Link>
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">Monthly pickup and drop, without the daily booking.</h2>
          <p className="mt-4 max-w-md text-blue-100">Subscribe once, get a verified driver on your schedule, and follow every trip live.</p>
        </div>
        <p className="text-sm text-blue-200">Customers · Drivers · Administrators</p>
      </aside>
      <main className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
          <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
        </div>
      </main>
    </div>
  );
}
