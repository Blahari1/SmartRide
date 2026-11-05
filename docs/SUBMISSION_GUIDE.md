# SmartRide — Submission and Live Test Guide

## 1. Product goal

SmartRide coordinates recurring home-to-work/college commutes. Its intended impact is:
- reduced commuting stress for daily travelers;
- safer, more reliable journeys through admin-verified drivers;
- predictable transportation costs using a transparent ₹5–₹10/km rate;
- recurring subscription revenue for the service;
- stable recurring work for drivers.

## 2. Three roles

### Customer
- Register and complete profile.
- Save pickup and drop locations.
- Search locations by typing; choose one of the suggested matching addresses, or use GPS/map selection.
- Select a monthly or yearly subscription duration.
- Select outbound, return or both journeys, service weekdays, pickup time and drop time (return times for round trips).
- Review the road-distance fare and submit a commute request.
- The request is broadcast to approved, available drivers.
- Track the driver acceptance, assigned driver and recurring schedule.

### Driver
- Register and submit driver details and licence-document reference.
- Wait for admin verification.
- Only approved and available drivers can view/accept requests.
- Open **Available Requests**, review customer, route, fare, weekdays and times.
- Accept a request. The first driver to accept wins through an atomic database update.
- SmartRide creates recurring schedules and trips for the selected term.
- Driver/customer recurring time conflicts are checked across the full subscription period, not just the first generated trip window.

### Admin
- Review and approve/reject drivers.
- Configure a per-kilometre rate between ₹5 and ₹10.
- Manage subscription duration plans.
- View customers, driver verification, customer-to-driver assignments, schedules and trips.
- The **Customer commute assignments** page shows which driver accepted each customer and the requested pickup/drop times.

## 3. Fare calculation

Per-trip fare:

`road distance in kilometres × configured rate per kilometre`

Subscription estimate:

`sum of selected direction fares per service day × estimated service days per month × subscription months`

Outbound and return legs are routed and priced separately. The backend recalculates the fare using the customer's saved coordinates and the active rate. The rate and route calculation are stored as a snapshot on the subscription.

No fixed monthly price is imposed. Admin configures only the per-kilometre rate (₹5–₹10).

## 4. Start locally

Keep your existing `.env` files; they are not packaged in the source ZIP.

Terminal 1:

```bash
cd SmartRide/backend
npm install
npm run check
npm test
npm start
```

Terminal 2:

```bash
cd SmartRide/frontend
npm install
npm run check
npm run build
npm run dev
```

Open `http://localhost:5173`.

## 5. Live test sequence

1. Admin: run `npm run list-admins` from `backend`. If no admin exists, use `npm run create-admin`. Log in.
2. Admin: open Driver Verification and approve a driver after reviewing the licence document.
3. Driver: log in and confirm the verification page shows approved.
4. Customer: register/log in and save pickup and drop locations. Type an address and confirm suggestions appear.
5. Admin: open Per-kilometre Pricing and save a rate between ₹5 and ₹10.
6. Customer: select a duration, directions, weekdays, pickup/drop times; review the road-distance fare and submit.
7. Driver: open Available Requests. Confirm the request appears and accept it.
8. Admin: open Customer commute assignments. Confirm the customer row shows the accepting driver and times.
9. Customer: open My Subscription and confirm assigned driver, subscription term and schedule are visible.
10. Driver: open today's/upcoming schedule. Confirm pickup/drop times and customer route.
11. Attempt to accept another request that overlaps the same driver's reserved weekday/time window; the server should reject it.
12. Test a non-overlapping request and confirm it can be accepted.
13. Verify trips appear and that only the assigned driver can start/complete them.
14. Test one-way outbound, one-way return and two-way route calculations separately.

## 6. Checks available in the source

The backend static check validates backend syntax, relative imports and route handlers. The frontend check validates relative imports. Offline unit suites cover route/fare maths, route-provider stubs, direction-aware schedules, trip/tracking permissions and authentication helpers.

A successful offline test does not prove Atlas connectivity, real Photon/OSRM availability, browser geolocation permission, or a complete live browser workflow. Run the live sequence above on your machine before submission.

## 7. Security and configuration

- Keep MongoDB Atlas credentials and JWT secrets in `.env`; never commit them or paste them into chat.
- Rotate any database password that was previously exposed.
- Use HTTPS for deployment because browser geolocation requires a secure context (localhost is allowed for development).
- Photon and OSRM public demo services are suitable for a student demo only; observe their usage policies and use a managed provider for production-scale traffic.
