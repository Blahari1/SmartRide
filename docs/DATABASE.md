# SmartRide database reference

Database: `smartride` (MongoDB Atlas). Use the same URI configured in `backend/.env`.

| Collection | Purpose | Important fields |
|---|---|---|
| `users` | Three-role accounts | `name, email, phone, role(customer/driver/admin), passwordHash, isActive` |
| `customerprofiles` | Customer saved route | `userId, pickupLocation{address,landmark,latitude,longitude}, dropLocation{…}` |
| `driverprofiles` | Driver verification | `userId, fullName, phone, licenseNumber, licenseValidUntil, documents[], verificationStatus, rejectionReason, verifiedBy, verifiedAt, availability` |
| `subscriptionplans` | Month/year duration options | `name, slug, durationMonths, description, features[], isActive` |
| `pricingconfigs` | Versioned rate per kilometre | `ratePerKmPaise, effectiveFrom, isActive, note, createdBy`; rate must be ₹5–₹10/km |
| `subscriptions` | Customer commute requests | `userId, planId, planSnapshot, fareSnapshot, requestSchedule{pickupTime,dropTime,returnPickupTime,returnDropTime,serviceDays,directions}, assignedDriverId, acceptedAt, status, startDate, endDate` |
| `schedules` | Recurring pickup/drop reservations | `userId, subscriptionId, direction, pickupLocation, dropLocation, pickupTime, dropTime, serviceDays[], startDate, endDate, driverId, status, isOpen` |
| `trips` | Individual service-day trips | `scheduleId, userId, subscriptionId, date(IST), direction, pickupTime, dropTime, startMin, endMin, driverId, status, lastLocation` |
| `notifications` | In-app/realtime notices | `userId, type, category, title, message, related, isRead, readAt` |
| `ratings` | Trip feedback | `tripId, userId, driverId, rating, feedback` |

## Important indexes and constraints

- `users.email` is unique.
- `customerprofiles.userId` and `driverprofiles.userId` are unique.
- `subscriptionplans.slug` is unique.
- `pricingconfigs` indexes active/effective configurations.
- At most one active and one pending subscription per customer.
- At most one open schedule per subscription and direction.
- A trip is unique per schedule and service date.
- Open trips have direction-aware customer uniqueness.
- Driver time-slot and active-trip indexes prevent duplicate assignments.
- Full recurring schedule conflicts are also checked in the scheduling service for shared weekdays and overlapping times across the subscription date range.

## Fare snapshot

The active rate is stored as integer paise per kilometre. The server calculates:

`perTripFarePaise = round(roadDistanceMeters × ratePerKmPaise / 1000)`

Each selected direction is routed separately. The subscription stores the rate, road distance, per-trip fare, service weekdays, estimated service days per month, duration and total estimate. Later pricing changes do not rewrite an existing subscription snapshot.

## Existing database note

Collections from earlier project iterations may remain in an existing Atlas database. This update does not delete historical data.
