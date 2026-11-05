// Focused navigation for SmartRide's three roles.
export const NAV = {
  customer: [
    { heading: "My commute", items: [
      { to: "/customer", label: "Dashboard", icon: "home", end: true },
      { to: "/customer/plans", label: "Request a commute", icon: "route" },
      { to: "/customer/subscriptions", label: "My subscription", icon: "calendar" },
      { to: "/customer/schedule", label: "Pickup schedule", icon: "clock" },
      { to: "/customer/trips", label: "Trip history", icon: "car", end: true },
      { to: "/customer/tracking", label: "Live tracking", icon: "radio" },
    ] },
    { heading: "Locations & account", items: [
      { to: "/customer/locations/pickup", label: "Pickup location", icon: "pin" },
      { to: "/customer/locations/drop", label: "Drop location", icon: "map-pin" },
      { to: "/customer/profile", label: "My profile", icon: "user", end: true },
    ] },
  ],
  driver: [
    { heading: "Driver workspace", items: [
      { to: "/driver", label: "Dashboard", icon: "home", end: true },
      { to: "/driver/verification", label: "Verification", icon: "shield" },
      { to: "/driver/requests", label: "Available requests", icon: "inbox" },
      { to: "/driver/customers", label: "My customers", icon: "users" },
      { to: "/driver/schedule/today", label: "Today's schedule", icon: "calendar" },
      { to: "/driver/schedule/upcoming", label: "Upcoming schedule", icon: "clock" },
      { to: "/driver/trips", label: "Trips", icon: "car", end: true },
      { to: "/driver/profile", label: "My profile", icon: "user" },
    ] },
  ],
  admin: [
    { heading: "Overview", items: [
      { to: "/admin", label: "Dashboard", icon: "home", end: true },
      { to: "/admin/customers", label: "Customers", icon: "users" },
      { to: "/admin/drivers", label: "Drivers", icon: "user", end: true },
      { to: "/admin/drivers/verification", label: "Driver verification", icon: "shield" },
    ] },
    { heading: "Operations", items: [
      { to: "/admin/subscriptions", label: "Customer assignments", icon: "users" },
      { to: "/admin/schedules", label: "Pickup schedules", icon: "calendar" },
      { to: "/admin/trips", label: "Trips", icon: "route" },
      { to: "/admin/live", label: "Live trips", icon: "radio" },
    ] },
    { heading: "Management", items: [
      { to: "/admin/plans", label: "Subscription durations", icon: "calendar-range" },
      { to: "/admin/pricing", label: "Per-kilometre pricing", icon: "tag" },
      { to: "/admin/profile", label: "Admin profile", icon: "user" },
    ] },
  ],
};
export const basePath = (role) => `/${role}`;
