import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authStore";
import { NotificationProvider } from "../context/NotificationContext";
import { useNotifications } from "../context/notificationStore";
import { LocationShareProvider } from "../context/LocationShareContext";
import { useLocationShare } from "../context/locationShareStore";
import { listNotifications, markAllRead } from "../services/notificationService";
import { NAV } from "../lib/nav";
import { ago } from "../lib/format";
import Icon from "./Icon";
import { Avatar } from "./ui";

function SessionBanner() {
  const { expiresAt } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!expiresAt) return null;
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  if (left > 120) return null;
  return (
    <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      Your session ends in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}. Finish what you are doing; you will need to log in again.
    </div>
  );
}

function NotificationBell({ base }) {
  const { unread, setUnread, connected, version } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState({ key: -1, list: [] });
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    listNotifications({ limit: 6 }).then((r) => { if (live) setItems({ key: version, list: r.notifications }); }).catch(() => {});
    return () => { live = false; };
  }, [open, version]);
  return (
    <div className="relative">
      <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
        <Icon name="bell" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
        <span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-white ${connected ? "bg-emerald-500" : "bg-slate-300"}`} title={connected ? "Real-time updates on" : "Real-time updates off"} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-bold">Notifications</span>
            <button type="button" className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => markAllRead().then(() => { setUnread(0); setItems((i) => ({ ...i, list: i.list.map((n) => ({ ...n, isRead: true })) })); })}>Mark all read</button>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {items.list.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</li>}
            {items.list.map((n) => (
              <li key={n._id} className={`px-4 py-3 text-sm ${n.isRead ? "" : "bg-blue-50/60"}`}>
                <p className="font-semibold text-slate-900">{n.title}</p><p className="text-slate-600">{n.message}</p><p className="mt-0.5 text-xs text-slate-400">{ago(n.createdAt)}</p>
              </li>
            ))}
          </ul>
          <Link to={`${base}/notifications`} onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-slate-50">View all</Link>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ base }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const profilePath = user.role === "admin" ? `${base}/profile` : `${base}/profile`;
  return (
    <div className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100">
        <Avatar name={user.name} /><span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 md:inline">{user.name}</span><Icon name="down" className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2.5"><p className="truncate text-sm font-bold">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p><p className="mt-1 text-xs font-semibold capitalize text-blue-700">{user.role}</p></div>
          <Link role="menuitem" to={profilePath} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Icon name="user" className="h-4 w-4" />Profile</Link>
          <Link role="menuitem" to={`${base}/settings`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Icon name="settings" className="h-4 w-4" />Settings</Link>
          <button role="menuitem" type="button" onClick={() => { logout(); navigate("/login"); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"><Icon name="logout" className="h-4 w-4" />Log out</button>
        </div>
      )}
    </div>
  );
}

function SharingPill() {
  const share = useLocationShare();
  if (!share || share.state !== "sharing") return null;
  return (
    <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 sm:inline-flex">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Sharing location
      <button type="button" onClick={share.stop} className="underline">Stop</button>
    </span>
  );
}

function Toast() {
  const { toast, dismissToast } = useNotifications();
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 w-80 max-w-[92vw] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3"><span className="mt-0.5 text-blue-700"><Icon name="bell" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{toast.title}</p><p className="text-sm text-slate-600">{toast.message}</p></div>
        <button type="button" aria-label="Dismiss" onClick={dismissToast} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-4 w-4" /></button></div>
    </div>
  );
}

function Shell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const base = `/${user.role}`;
  const groups = NAV[user.role] || [];
  useEffect(() => { const id = setTimeout(() => setOpen(false), 0); return () => clearTimeout(id); }, [loc.pathname]);

  const link = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100"}`;
  const sidebar = (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
      {groups.map((g) => (
        <div key={g.heading}>
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.heading}</p>
          <div className="space-y-0.5">{g.items.map((it) => <NavLink key={it.to} to={it.to} end={it.end} className={link}><Icon name={it.icon} className="h-4 w-4" />{it.label}</NavLink>)}</div>
        </div>
      ))}
    </nav>
  );
  const brand = (
    <Link to={base} className="flex items-center gap-2 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 font-extrabold text-white">S</span><span className="text-lg font-extrabold tracking-tight text-slate-900">SmartRide</span></Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">{brand}{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3">{brand}<button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded p-2 hover:bg-slate-100"><Icon name="x" /></button></div>{sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <SessionBanner />
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Icon name="menu" /></button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">{user.role} portal</span>
            {user.role === "driver" && <SharingPill />}
          </div>
          <div className="flex items-center gap-1"><NotificationBell base={base} /><ProfileMenu base={base} /></div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
      </div>
      <Toast />
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const shell = <NotificationProvider><Shell /></NotificationProvider>;
  return user.role === "driver" ? <LocationShareProvider>{shell}</LocationShareProvider> : shell;
}

