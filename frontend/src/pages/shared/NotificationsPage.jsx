import { useState } from "react";
import { useAsync, useAction } from "../../hooks/useAsync";
import { listNotifications, markAllRead, markRead } from "../../services/notificationService";
import { useNotifications } from "../../context/notificationStore";
import { Alert, Async, Button, Card, EmptyState, PageHeader, Pagination, Tabs } from "../../components/ui";
import Icon from "../../components/Icon";
import { ago, fmtDateTime } from "../../lib/format";

const ICON = { account: "user", driver: "shield", subscription: "layers", schedule: "calendar", trip: "car", rating: "star" };

export default function NotificationsPage() {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const { setUnread, refresh, version } = useNotifications();
  const state = useAsync(() => listNotifications({ page, limit: 15, unread: tab === "unread" ? "true" : undefined }), `${tab}-${page}-${version}`);
  const act = useAction();
  const change = (t) => { setTab(t); setPage(1); };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Everything that happened on your account, newest first." actions={<Button variant="secondary" busy={act.busy} onClick={() => act.run(async () => { await markAllRead(); setUnread(0); state.reload(); })}>Mark all as read</Button>} />
      <Alert>{act.error}</Alert>
      <Tabs tabs={[{ key: "all", label: "All" }, { key: "unread", label: "Unread" }]} value={tab} onChange={change} />
      <Async state={state}>{(d) => (
        d.notifications.length === 0 ? <EmptyState icon="bell" title={tab === "unread" ? "You are all caught up" : "No notifications yet"} hint="New activity on your account will appear here." /> : (
          <>
            <Card padded={false}><ul className="divide-y divide-slate-100">
              {d.notifications.map((n) => (
                <li key={n._id} className={`flex gap-4 px-5 py-4 ${n.isRead ? "" : "bg-blue-50/50"}`}>
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon name={ICON[n.category] || "bell"} className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{n.title}</p><p className="text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400" title={fmtDateTime(n.createdAt)}>{ago(n.createdAt)}</p></div>
                  {!n.isRead && <Button size="sm" variant="ghost" onClick={() => markRead(n._id).then(() => { setUnread((u) => Math.max(0, u - 1)); state.reload(); refresh(); })}>Mark read</Button>}
                </li>
              ))}
            </ul></Card>
            <Pagination page={d.page} limit={d.limit} total={d.total} onPage={setPage} />
          </>
        )
      )}</Async>
    </>
  );
}
