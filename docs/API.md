# SmartRide API reference

Base URL: `http://localhost:5001/api`. All bodies are JSON. Authenticated routes need `Authorization: Bearer <JWT>`.

This reference describes the current three-role commute workflow. Roles are enforced by `allowRoles` on the server; the UI is never the authority.

Error format: `{ "success": false, "message": "…" }` with 400 (validation), 401 (missing/invalid/expired token), 403 (wrong role / unapproved driver), 404 (not found **or** not yours), 409 (state conflict), 429 (rate limit).


## /api/auth

| Method | Path | Allowed roles |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | any authenticated |
| PATCH | `/api/auth/me` | any authenticated |
| POST | `/api/auth/change-password` | any authenticated |
| POST | `/api/auth/logout` | any authenticated |

## /api/profile

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/profile/me` | customer |
| PUT | `/api/profile/me` | customer |

## /api/customers

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/customers/me/dashboard` | customer |

## /api/subscription-plans

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/subscription-plans` | public |
| GET | `/api/subscription-plans/admin` | admin |
| POST | `/api/subscription-plans` | admin |
| PATCH | `/api/subscription-plans/:id/status` | admin |
| PATCH | `/api/subscription-plans/:id` | admin |

## /api/subscriptions

| Method | Path | Allowed roles |
|---|---|---|
| POST | `/api/subscriptions` | customer |
| GET | `/api/subscriptions/my` | customer |
| GET | `/api/subscriptions` | admin |
| POST | `/api/subscriptions/:id/cancel` | customer, admin |
| GET | `/api/subscriptions/:id` | customer, admin |

## /api/drivers

| Method | Path | Allowed roles |
|---|---|---|
| POST | `/api/drivers/profile` | driver |
| GET | `/api/drivers/me` | driver |
| PATCH | `/api/drivers/me` | driver |
| GET | `/api/drivers/me/dashboard` | driver |
| GET | `/api/drivers/me/customers` | driver |
| PATCH | `/api/drivers/me/availability` | driver |
| GET | `/api/drivers/requests` | approved, available driver |
| POST | `/api/drivers/requests/:id/accept` | approved, available driver |
| GET | `/api/drivers` | admin |
| GET | `/api/drivers/pending` | admin |
| GET | `/api/drivers/:id` | admin |
| PATCH | `/api/drivers/:id/verify` | admin |
| PATCH | `/api/drivers/:id/availability` | admin |

## /api/schedules

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/schedules/my` | customer |
| GET | `/api/schedules/driver/my` | driver |
| GET | `/api/schedules/trips` | admin |
| PATCH | `/api/schedules/trips/:tripId/status` | admin, driver |
| GET | `/api/schedules` | admin |
| GET | `/api/schedules/:id` | customer, admin |
| POST | `/api/schedules/:id/cancel` | admin |
| POST | `/api/schedules/:id/generate` | admin |

## /api/trips

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/trips/my` | customer |
| GET | `/api/trips/:id` | customer, driver, admin |

## /api/tracking

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/tracking/active` | admin |
| POST | `/api/tracking/trips/:tripId/location` | driver |
| GET | `/api/tracking/trips/:tripId` | customer, driver, admin |

## /api/pricing

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/pricing/active` | customer, driver, admin |
| POST | `/api/pricing/quote` | customer |
| POST | `/api/pricing/route` | customer, driver, admin |
| POST | `/api/pricing/geocode/search` | customer, driver, admin |
| POST | `/api/pricing/geocode/reverse` | customer, driver, admin |
| GET | `/api/pricing` | admin |
| POST | `/api/pricing` | admin |
| PATCH | `/api/pricing/:id/status` | admin |

Address suggestions appear as the customer types. The backend proxies Photon search requests and Nominatim reverse-geocoding. Route calculations use OSRM and never fall back to straight-line distance.

## /api/ratings

| Method | Path | Allowed roles |
|---|---|---|
| POST | `/api/ratings` | customer |
| GET | `/api/ratings/my` | customer |
| GET | `/api/ratings/driver/my` | driver |
| GET | `/api/ratings` | admin |

## /api/notifications

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/notifications` | any authenticated |
| GET | `/api/notifications/unread-count` | any authenticated |
| PATCH | `/api/notifications/read-all` | any authenticated |
| PATCH | `/api/notifications/:id/read` | any authenticated |

## /api/admin

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/admin/dashboard` | admin |
| GET | `/api/admin/reports` | admin |
| GET | `/api/admin/customers` | admin |
| GET | `/api/admin/customers/:id` | admin |
| PATCH | `/api/admin/customers/:id/status` | admin |

## /api/users

| Method | Path | Allowed roles |
|---|---|---|
| GET | `/api/users` | admin |

## Key request bodies and rules

| Endpoint | Body | Notes |
|---|---|---|
| `POST /auth/register` | `{name, email, password(8-72), phone?, accountType: "customer"\|"driver"}` | Admin accounts cannot be registered here (`npm run create-admin`). |
| `POST /auth/login` | `{email, password}` | Returns `{token, user}`; JWT lifetime `JWT_EXPIRES_IN` (15m). |
| `PATCH /auth/me` | `{name?, phone?}` | Role and email cannot be changed. |
| `POST /auth/change-password` | `{currentPassword, newPassword}` | |
| `PUT /profile/me` | `{name?, phone?, pickupLocation?, dropLocation?}` | Location = `{address, landmark?, latitude, longitude}`. |
| `POST /subscription-plans` | `{name, slug, durationMonths, description?, features?}` | Admin creates a duration/features plan. No fixed price is accepted; fare comes from Pricing Configuration. |
| `PATCH /subscription-plans/:id` | `{name?, slug?, durationMonths?, description?, features?}` | Updates duration and included features; fare is calculated separately from route distance. |
| `POST /subscriptions` | `{planId, directions: ["outbound"\|"return"], serviceDays: [0-6], pickupTime, dropTime, returnPickupTime?, returnDropTime?}` | Requires saved pickup/drop coordinates and an active ₹5–₹10/km rate. Server calculates road distance and fare; price/distance are never accepted from the client. Request is broadcast to all approved, available drivers. |
| `GET /drivers/requests` | – | Approved, available drivers see all open customer commute requests with route, duration, weekdays and times. |
| `POST /drivers/requests/:id/accept` | `{}` | First eligible driver to accept wins atomically. Server creates recurring schedule(s) and trips; recurring weekday/time conflicts are checked across the full term. |
| `POST /pricing/quote` | `{planId, directions, serviceDays}` | Customer-only preview from saved locations and active pricing; not stored. |
| `POST /pricing/route` | `{from: {latitude, longitude}, to: {latitude, longitude}}` | Server returns road distance, ETA and route geometry. |
| `POST /pricing/geocode/search` | `{query}` | Returns address suggestions as the customer types; the UI lets the customer select the correct match. |
| `POST /pricing/geocode/reverse` | `{latitude, longitude}` | Reverse-geocodes a selected map/GPS point. |
| `PATCH /schedules/trips/:tripId/status` | `{status, reason?}` | Driver: confirmed→in_progress (service date only) →completed. Admin: any legal transition incl. cancel. |
| `POST /tracking/trips/:tripId/location` | `{latitude, longitude, accuracy?, heading?, speed?}` | Assigned driver, trip must be `in_progress`. REST fallback of the socket event. |
| `GET /tracking/trips/:tripId` | – | Role-scoped snapshot; position only when the trip is active. |
| `POST /ratings` | `{tripId, rating(1-5 integer), feedback?(≤500)}` | Owner of a completed trip, once per trip. |
| `PATCH /admin/customers/:id/status` | `{isActive: boolean}` | |

## Socket.IO events (server: `http://localhost:5001`)

Connect with `io(url, { auth: { token } })`. The handshake verifies the JWT and loads the user; the socket is closed when the JWT expires.

| Direction | Event | Payload | Rules |
|---|---|---|---|
| client → server | `trip:subscribe` | `{tripId}` (ack) | Owner customer, assigned driver or admin. Ended trips return state without joining a room. |
| client → server | `trip:unsubscribe` | `{tripId}` | |
| client → server | `admin:subscribe` | – (ack returns active trips) | Admin only. |
| client → server | `location:update` | `{tripId, latitude, longitude, accuracy?, heading?, speed?}` (ack) | Assigned driver, trip `in_progress`, ≤ 1 per second per trip. |
| server → client | `location:update` | `{tripId, latitude, longitude, …, updatedAt}` | To `trip:<id>` room and `admin:live`. |
| server → client | `trip:status` | `{tripId, status, at}` | |
| server → client | `tracking:ended` | `{tripId, reason, at}` | Sent on completion/cancellation; sockets are removed from the room and the stored position is deleted. |
| server → client | `tracking:driver-offline` | `{tripId, at}` | Driver's publishing socket disconnected. |
| server → client | `notification:new` | notification document | To `user:<id>`. |

