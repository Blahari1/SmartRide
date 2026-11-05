# Postman collection

Import `docs/postman/SmartRide.postman_collection.json`.

Set collection variables:
- `baseUrl` = `http://localhost:5001/api`
- `adminToken`
- `customerToken`
- `driverToken`
- `planId`
- `subscriptionId`

Recommended sequence:
1. Register/login as customer and save `customerToken`.
2. Login as admin and save `adminToken`.
3. Admin creates/activates a subscription duration plan and a rate between ₹5 and ₹10/km.
4. Customer saves pickup/drop locations through `/profile/me`.
5. Customer requests a commute using `/subscriptions` with `planId`, directions, service weekdays and pickup/drop times.
6. Login as an approved driver and save `driverToken`.
7. Driver calls `/drivers/requests` and accepts with `/drivers/requests/:id/accept`.
8. Admin calls `/subscriptions` to see the assigned driver and calls `/schedules` to inspect recurring schedules.
9. Driver/customer test `/schedules/driver/my`, `/trips/my`, and tracking endpoints.

