import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/authStore";
import { useAsync } from "../../hooks/useAsync";
import { getTrip } from "../../services/tripService";
import RouteMapCard from "../../components/RouteMapCard";
import { Async, Badge, Card, DL, LinkButton, PageHeader, Stars } from "../../components/ui";
import { dirLabel, fmtDateTime, fmtDayLong, fmtTime } from "../../lib/format";

// One trip detail view for customer, driver and admin; the API decides which fields each role receives.
export default function TripDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = `/${user.role}`;
  const state = useAsync(() => getTrip(id), id);
  return (
    <Async state={state}>{({ trip }) => {
      const track = trip.status === "in_progress" || trip.status === "confirmed";
      return (
        <>
          <PageHeader title={`${trip.servicePeriod === "morning" ? "Morning" : "Evening"} trip · ${fmtDayLong(trip.date)}`} subtitle={`${dirLabel(trip.direction)} · Pickup ${fmtTime(trip.pickupTime)} · Drop ${fmtTime(trip.dropTime)}`}
            breadcrumbs={[{ label: "Trips", to: user.role === "admin" ? "/admin/trips" : `${base}/trips` }, { label: "Trip details" }]}
            actions={<>{user.role === "customer" && track && <LinkButton variant="primary" to={`/customer/tracking/${trip.id}`}>Track live</LinkButton>}
              {user.role === "customer" && trip.canRate && <LinkButton variant="primary" to={`/customer/ratings?trip=${trip.id}`}>Rate this trip</LinkButton>}
              {user.role === "admin" && track && <LinkButton to="/admin/live">Live board</LinkButton>}
              {user.role === "driver" && trip.status === "in_progress" && <LinkButton variant="primary" to="/driver/active-trip">Open active trip</LinkButton>}</>} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <RouteMapCard pickup={trip.pickupLocation} drop={trip.dropLocation} fitKey={trip.id} label={dirLabel(trip.direction)} />
              <Card title="Route"><DL items={[["Pickup address", trip.pickupLocation?.address], ["Pickup landmark", trip.pickupLocation?.landmark], ["Drop address", trip.dropLocation?.address], ["Drop landmark", trip.dropLocation?.landmark]]} /></Card>
              {trip.rating && <Card title="Rating"><Stars value={trip.rating.rating} showValue />{trip.rating.feedback && <p className="mt-2 text-sm text-slate-700">“{trip.rating.feedback}”</p>}<p className="mt-1 text-xs text-slate-400">{fmtDateTime(trip.rating.createdAt)}</p></Card>}
            </div>
            <div className="space-y-6">
              <Card title="Status"><DL cols={1} items={[["Status", <Badge key="s" value={trip.status} />], ["Started", trip.startedAt && fmtDateTime(trip.startedAt)], ["Completed", trip.completedAt && fmtDateTime(trip.completedAt)], trip.status === "cancelled" && ["Cancelled", fmtDateTime(trip.cancelledAt)], trip.cancelReason && ["Reason", trip.cancelReason]]} /></Card>
              {trip.customer && <Card title="Customer"><DL cols={1} items={[["Name", user.role === "admin" ? <Link key="c" className="text-blue-700 hover:underline" to={`/admin/customers/${trip.customer.id}`}>{trip.customer.name}</Link> : trip.customer.name], ["Phone", trip.customer.phone], trip.customer.email && ["Email", trip.customer.email]]} /></Card>}
              <Card title="Assigned driver"><DL cols={1} items={[["Driver", trip.driver ? (user.role === "admin" ? <Link key="d" className="text-blue-700 hover:underline" to={`/admin/drivers/${trip.driver.id}`}>{trip.driver.name}</Link> : trip.driver.name) : "Not assigned yet"], ["Driver phone", trip.driver?.phone]]} /></Card>
            </div>
          </div>
        </>
      );
    }}</Async>
  );
}
