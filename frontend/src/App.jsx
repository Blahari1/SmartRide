import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { homePathFor, useAuth } from "./context/authStore";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { EmptyState, LinkButton } from "./components/ui";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import NotificationsPage from "./pages/shared/NotificationsPage";
import AccountSettings from "./pages/shared/AccountSettings";
import TripDetail from "./pages/shared/TripDetail";
import CustomerDashboard from "./pages/customer/Dashboard";
import { EditProfile, LocationPage, MapSelection, MyProfile } from "./pages/customer/Profile";
import { ComparePlans, PlansPage } from "./pages/customer/Plans";
import { MySubscriptions, SubscriptionDetails, SubscriptionHistory } from "./pages/customer/Subscriptions";
import { LiveTracking, RatingsPage, TripList as CustomerTrips, UpcomingSchedule } from "./pages/customer/Rides";
import DriverDashboard from "./pages/driver/Dashboard";
import { Documents, EditDriverProfile, Licence, MyDriverProfile, Verification } from "./pages/driver/Profile";
import { AssignedCustomers, AvailableRideRequests, DriverRatings, DriverTrips, Schedule } from "./pages/driver/Work";
import { ActiveTrip, DriverMap, LocationSharing } from "./pages/driver/Trip";
import AdminDashboard from "./pages/admin/Dashboard";
import { CustomerDetail, CustomerList } from "./pages/admin/Customers";
import { DriverDetail, DriverList } from "./pages/admin/Drivers";
import AdminPlans from "./pages/admin/Plans";
import Pricing from "./pages/admin/Pricing";
import { SubscriptionDetail, SubscriptionList } from "./pages/admin/Subscriptions";
import { ScheduleDetail, ScheduleList, TripList as AdminTrips } from "./pages/admin/Operations";
import LiveTrips from "./pages/admin/Live";
import { AdminProfile, AdminRatings, Reports } from "./pages/admin/Insights";

function Root() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}
const NotFound = () => <div className="mx-auto max-w-lg p-10"><EmptyState icon="alert" title="Page not found" hint="The page you opened does not exist." action={<LinkButton variant="primary" to="/">Go to your dashboard</LinkButton>} /></div>;

// Keyed by path so navigating away from a crashed page clears the error.
function Guarded({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Guarded>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute roles={["customer"]} />}>
          <Route path="/customer" element={<Layout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="profile" element={<MyProfile />} />
            <Route path="profile/edit" element={<EditProfile />} />
            <Route path="locations/pickup" element={<LocationPage kind="pickup" />} />
            <Route path="locations/drop" element={<LocationPage kind="drop" />} />
            <Route path="locations/map" element={<MapSelection />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="plans/compare" element={<ComparePlans />} />
            <Route path="subscriptions" element={<MySubscriptions />} />
            <Route path="subscriptions/history" element={<SubscriptionHistory />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetails />} />
            <Route path="schedule" element={<UpcomingSchedule />} />
            <Route path="trips" element={<CustomerTrips />} />
            <Route path="trips/history" element={<CustomerTrips completedOnly />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="tracking" element={<LiveTracking />} />
            <Route path="tracking/:tripId" element={<LiveTracking />} />
            <Route path="ratings" element={<RatingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<AccountSettings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["driver"]} />}>
          <Route path="/driver" element={<Layout />}>
            <Route index element={<DriverDashboard />} />
            <Route path="profile" element={<MyDriverProfile />} />
            <Route path="profile/edit" element={<EditDriverProfile />} />
            <Route path="licence" element={<Licence />} />
            <Route path="documents" element={<Documents />} />
            <Route path="verification" element={<Verification />} />
            <Route path="requests" element={<AvailableRideRequests />} />
            <Route path="customers" element={<AssignedCustomers />} />
            <Route path="schedule/today" element={<Schedule when="today" />} />
            <Route path="schedule/upcoming" element={<Schedule when="upcoming" />} />
            <Route path="trips" element={<DriverTrips />} />
            <Route path="trips/history" element={<DriverTrips history />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="active-trip" element={<ActiveTrip />} />
            <Route path="map" element={<DriverMap />} />
            <Route path="location" element={<LocationSharing />} />
            <Route path="ratings" element={<DriverRatings />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<AccountSettings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<Layout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="drivers" element={<DriverList />} />
            <Route path="drivers/verification" element={<DriverList queue />} />
            <Route path="drivers/:id" element={<DriverDetail />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="subscriptions" element={<SubscriptionList />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
            <Route path="schedules" element={<ScheduleList />} />
            <Route path="schedules/:id" element={<ScheduleDetail />} />
            <Route path="trips" element={<AdminTrips />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="live" element={<LiveTrips />} />
            <Route path="ratings" element={<AdminRatings />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="settings" element={<AccountSettings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Guarded>
    </BrowserRouter>
  );
}
