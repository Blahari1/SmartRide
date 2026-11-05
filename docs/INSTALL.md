# SmartRide installation

## Requirements

- Node.js 20+ recommended.
- npm.
- MongoDB Atlas or local MongoDB.
- A modern browser. Browser GPS requires HTTPS or localhost.

## Backend

```bash
cd backend
cp .env.example .env
```

Configure:
- `MONGO_URI` — MongoDB connection string.
- `JWT_SECRET` — long random secret (at least 32 characters).
- `PORT=5001`
- `CLIENT_URL=http://localhost:5173`

Then:

```bash
npm install
npm run list-admins
# If no admin exists:
# ADMIN_NAME="Site Admin" ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='your-strong-password' npm run create-admin
npm run migrate-direction
npm run check
npm start
```

Health endpoint: `http://localhost:5001/api/health`.

## Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
```

Set `VITE_API_URL=http://localhost:5001/api`, then:

```bash
npm install
npm run check
npm run build
npm run dev
```

Open `http://localhost:5173`.

## Demo setup order

1. Create/check the admin account.
2. Admin approves a driver's profile and licence.
3. Customer saves pickup and drop addresses.
4. Admin configures a rate between ₹5 and ₹10 per kilometre and publishes duration plans.
5. Customer submits a commute request with direction(s), weekdays and pickup/drop times.
6. Driver accepts from Available Requests.
7. Admin verifies the customer-driver assignment and schedule.

## Environment and external services

- Do not commit `.env` or share Atlas credentials.
- Photon address suggestions, Nominatim reverse geocoding and OSRM routing use public demo services by default. They may throttle requests and are not intended for production traffic.
- Existing historical database collections are not deleted by the code update.
