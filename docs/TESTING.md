# SmartRide testing

## Offline checks run during this update

| Check | Result |
|---|---|
| Backend static check (`npm run check`) | Passed: 70 backend files |
| Frontend import check (`npm run check`) | Passed: 64 frontend files |
| Fare/routing/pricing suite (`node tests/pricing.test.js`) | 15 passed, 0 failed |
| Feature suite (`node tests/features.test.js`) | 20 passed, 0 failed |
| Direction-aware commute suite (`node tests/commute.test.js`) | 7 passed, 0 failed |
| Authentication helper suite (`node tests/auth.test.js`) | 3 passed, 0 failed |
| Combined selected suites | 45 passed, 0 failed |

The route provider is stubbed in offline tests. These tests do not prove real Photon/OSRM availability, MongoDB Atlas integration, Socket.IO transport or browser geolocation.

## Run checks locally

```bash
cd backend
npm run check
npm test
```

```bash
cd frontend
npm run check
npm run build
```

## Live checks still required

1. Connect to the actual MongoDB Atlas database.
2. Log in as admin and verify the admin dashboard.
3. Approve a driver and ensure pending/rejected drivers cannot access Available Requests.
4. Save customer pickup/drop locations and test typed address suggestions.
5. Save a ₹5–₹10/km rate.
6. Submit a customer request with selected subscription duration, direction(s), weekdays and times.
7. Verify all eligible drivers receive the request notification.
8. Accept the same request from two driver sessions; only the first acceptance should succeed.
9. Confirm the admin customer-driver overview shows the accepting driver.
10. Confirm recurring schedules and trips are created with the requested times.
11. Attempt an overlapping schedule for the same driver; it should be rejected across the entire subscription term.
12. Verify customer/driver trip views and live tracking.
13. Run `npm run build` and test the app in a browser at desktop and mobile widths.
