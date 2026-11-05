# SmartRide — Core Product Workflow

## Product outcome

SmartRide is a recurring commute coordination platform designed to:
- reduce daily commuting stress;
- improve safety and reliability through verified drivers;
- make commute costs predictable using road distance and a published per-kilometre rate;
- support recurring monthly and multi-year subscriptions;
- give drivers predictable recurring work.

## Roles

### Customer
1. Register and complete the customer profile.
2. Save Home/Pickup and College/Office/Drop locations. Address suggestions appear while typing; the customer chooses the correct result or uses device GPS/map placement.
3. Choose a subscription duration (month-based or year-based).
4. Choose outbound, return, or both directions and service weekdays.
5. Enter pickup and drop times (and return times for a two-way commute).
6. Review the road-distance fare estimate and submit the commute request.
7. Track the request until an approved driver accepts it.
8. View the assigned driver, recurring schedule, and trips.

### Driver
1. Register and submit profile, driving-licence details, and required document references.
2. Wait for admin verification. Pending/rejected drivers cannot accept customer requests.
4. An approved, available driver opens **Available Requests**. New customer requests are broadcast to all eligible drivers through in-app notifications and are also listed in this screen.
5. Driver reviews route, days, times, duration and estimated fare, then accepts.
6. The first eligible driver to claim the request wins. The claim is atomic; other drivers receive a conflict response and the request disappears on refresh.
7. SmartRide creates the recurring schedule and trip records. Existing schedule/trip conflict checks reserve the driver's pickup/drop time windows, preventing overlapping assignments.
8. Driver views customers, route, schedule and trip actions.

### Admin
1. Review and approve/reject driver profiles and licence documents.
3. Configure the per-kilometre rate and fare settings.
4. View customers, subscriptions, requests awaiting acceptance, accepted customer-driver pairs, recurring schedules and trips.
5. The subscription list shows each customer, assigned driver, duration, pickup/drop times and service period.

## Fare rules

- The active rate is configurable by admin and constrained to **₹5–₹10 per road kilometre**.
- Per-trip fare = actual road distance in kilometres × configured rate per kilometre.
- Route distance is calculated using the routing service; straight-line distance is not substituted when routing fails.
- Fare is computed on the server from saved pickup/drop coordinates and the active configuration.
- One-way outbound, one-way return, and two-way commute legs are calculated separately.
- The monthly/term estimate uses the selected weekdays and subscription duration.
- The customer sees the fare estimate before submitting. The backend recalculates it when creating the request.
- The fare/configuration snapshot is stored on the subscription, so later rate changes do not rewrite an existing request.

## Time-slot protection

A commute request includes pickup and drop times. When a driver accepts it, SmartRide creates recurring schedules for the selected weekdays and subscription term. The scheduling service checks driver/customer conflicts before creating trips. A conflicting request is not accepted for that driver; the request remains available to another eligible driver.

A verified driver can accept a request directly. The driver's recurring pickup/drop time windows are reserved by schedule conflict checks.

## Important implementation notes

- New requests use the driver-acceptance workflow. Existing database collections from older project iterations are left untouched; the current application does not depend on them.
- Existing subscriptions and trip history are not deleted by these code changes.
- The first accepting driver is assigned; there is no admin manual assignment step required for the initial customer request.
- The admin dashboard and subscription list are the operational overview for customer-to-driver assignment.
