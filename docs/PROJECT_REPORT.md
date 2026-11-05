# SmartRide — Project Report

## 1. Introduction

SmartRide is a subscription-based recurring commute coordination platform for daily travelers. Customers request a regular pickup-and-drop service for a chosen month/year duration. Their request is shared with verified, available drivers; the first eligible driver to accept becomes responsible for that recurring commute.

## 2. Expected Impact

- Reduced commuting stress for daily travelers.
- Increased safety and reliability through admin-verified drivers.
- Predictable transportation cost through road-distance pricing.
- A scalable subscription-based revenue model.
- Stable income opportunities for drivers through recurring customers.

## 3. User Roles

### Customer
Customers manage their profile and pickup/drop locations, search for addresses using suggestions, choose subscription duration and service weekdays, select pickup/drop times, review the route-based fare, submit a commute request, and view their assigned driver and schedule.

### Driver
Drivers submit their details and licence documents for admin verification. Approved drivers can view commute requests shared with all eligible drivers and accept a request. The first successful acceptance reserves the recurring time slot and assigns the customer.

### Admin
Administrators verify drivers, configure the per-kilometre rate, manage subscription duration plans, and monitor customer-driver assignments, recurring schedules and trips.

## 4. Fare Model

Admin configures a rate between ₹5 and ₹10 per road kilometre.

`Per-trip fare = actual road distance (km) × configured rate (₹/km)`

The subscription estimate is based on the selected direction(s), service weekdays and subscription duration. Outbound and return routes are calculated independently. The server computes the fare from saved coordinates and stores the rate/route snapshot with the request.

## 5. Main Workflow

1. Customer saves pickup and drop locations.
2. Customer selects duration, direction(s), weekdays and pickup/drop times.
3. SmartRide calculates road distance and the subscription estimate.
4. Customer submits the commute request.
5. The system notifies all approved, available drivers.
6. The first eligible driver to accept wins through an atomic database update.
7. SmartRide creates recurring schedule(s) and trip records.
8. Full-term recurring conflict checks prevent the driver from accepting overlapping weekday/time slots.
9. Admin sees the customer and assigned driver in the operational overview.
10. Customer and driver use their dashboards to view schedule and trip progress.

## 6. Technology Stack

- Frontend: React, Vite, Tailwind CSS.
- Backend: Node.js, Express.
- Database: MongoDB Atlas and Mongoose.
- Authentication: JWT and bcrypt.
- Maps: Leaflet and OpenStreetMap.
- Address suggestions: Photon geocoding; reverse geocoding uses Nominatim.
- Road routing: OSRM.
- Realtime: Socket.IO.

## 7. Reliability and Safety Controls

- Role-based route protection for customer, driver and admin.
- Driver verification before access to available requests.
- Licence validity checked before acceptance.
- Atomic first-driver acceptance.
- Server-side route and fare calculation; client-supplied price/distance is not trusted.
- Pickup/drop time and weekday reservations checked across the subscription term.
- Trip start/completion restricted to the assigned driver.
- Existing schedule/trip conflict checks and live tracking permissions are preserved.

## 8. Limitations and Future Work

- Public Photon/OSRM endpoints are suitable for a demonstration, not production-scale traffic.
- Real browser geolocation, external geocoding/routing and MongoDB Atlas must be tested in the target environment.
- Secure document uploads should replace plain document references before production.
- Native mobile push notifications and traffic-aware ETA can be added later.
- Full browser automation and production deployment checks remain to be performed.

## 9. Conclusion

SmartRide provides a focused recurring-commute workflow that connects customers with verified drivers, calculates fares transparently from actual road distance, reserves recurring pickup/drop time slots, and gives administrators an operational view of customer-driver assignments.
