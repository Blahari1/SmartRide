# SmartRide live integration test checklist

Run this against a disposable/test MongoDB Atlas database, not production data.

1. Admin login and driver verification.
2. Customer profile with pickup/drop coordinates.
3. Admin creates a duration plan and an active rate between ₹5 and ₹10/km.
4. Customer creates a request with pickup/drop times, weekdays and directions.
5. Approved drivers receive notifications and can list the open request.
6. Two drivers race to accept: only one request claim succeeds.
7. Driver acceptance creates recurring schedule(s) and trip records.
8. Admin subscription overview shows the customer and assigned driver.
9. Overlapping recurring weekdays/times for the same driver are rejected.
10. Customer and driver can view their schedule/trips.
11. Only the assigned driver can start and complete their trips.
12. Verify browser address suggestions, GPS permission and road-route rendering.

Record actual HTTP status codes, response bodies, browser console output and MongoDB records. Do not mark a step passed without running it.
