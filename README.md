# SmartRide — Recurring Commute Subscription Platform

SmartRide is a web-based recurring commute platform that connects customers who need regular pickup-and-drop transportation with admin-verified drivers.

Customers can request a recurring commute for a selected duration, choose pickup and drop locations, set travel days and times, and view a fare calculated using actual road distance. Eligible verified drivers receive open requests; the first eligible driver to accept is assigned the commute.

## Main features

### Customer
- Register and sign in securely.
- Select pickup and drop locations.
- Use location suggestions and supported location features.
- Choose commute days, pickup/drop times, and a subscription duration.
- Review route distance and estimated fare before submitting a request.
- View assigned driver, recurring schedule, trips, and notifications.

### Driver
- Register and submit profile details for admin verification.
- Set availability.
- View eligible open commute requests after approval.
- Accept a request; the first successful eligible acceptance is assigned.
- View assigned customers, schedules, trips, and feedback.

### Admin
- Review and verify driver applications.
- Configure subscription duration plans and per-kilometre pricing.
- Monitor customer-to-driver assignments, schedules, and trips.

## Fare calculation

The fare is calculated from actual road-route distance:

`Fare per trip = road distance (km) × configured rate (₹/km)`

The administrator configures the per-kilometre rate within the application's supported range. Outbound and return routes are handled separately where applicable.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4, React Router |
| Maps | Leaflet, OpenStreetMap |
| Backend | Node.js, Express |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JSON Web Tokens (JWT), bcryptjs |
| Real-time features | Socket.IO |
| Routing and distance | OSRM |
| Address search | Photon / OpenStreetMap geocoding services |

## Project structure

```text
SmartRide/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   ├── scripts/
│   ├── .env.example
│   └── package.json
├── docs/
└── README.md
```

## Requirements

- Node.js (use a current LTS release)
- npm
- MongoDB Atlas account or a reachable MongoDB instance
- Git

## Run locally

### 1. Clone the repository

```bash
git clone https://github.com/Blahari1/SmartRide.git
cd SmartRide
```

### 2. Configure and start the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and set your own values:

- `PORT=5001`
- `MONGO_URI` — your MongoDB connection string
- `JWT_SECRET` — a strong random secret of at least 32 bytes
- `CLIENT_URL=http://localhost:5173`

Keep `.env` private. Never commit it or share its values publicly.

Then run:

```bash
npm run check
npm test
npm start
```

The backend health endpoint is:

`http://localhost:5001/api/health`

### 3. Configure and start the frontend

Open a second terminal:

```bash
cd SmartRide/frontend
npm install
cp .env.example .env
```

Set the frontend API URL in `frontend/.env`:

```env
VITE_API_URL=http://localhost:5001/api
```

Then run:

```bash
npm run check
npm run build
npm run dev
```

Open `http://localhost:5173`.

## Deployment

The suggested hosting arrangement is:

- **Frontend:** Vercel
- **Backend:** Render (Node.js Web Service)
- **Database:** MongoDB Atlas

### Backend deployment on Render

Create a new **Web Service** and connect the GitHub repository.

Configure:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Add the backend environment variables in Render's Environment settings. Use the existing MongoDB Atlas connection string privately, and set:

- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — strong secret of at least 32 bytes
- `CLIENT_URL` — deployed Vercel frontend origin, for example `https://your-app.vercel.app`
- `NODE_ENV=production` (if used by your deployment configuration)

Render supplies the `PORT` environment variable. Do not hard-code a production port.

After deployment, verify:

`https://YOUR-BACKEND-SERVICE.onrender.com/api/health`

The response should report that the server is running and the database is connected.

### Frontend deployment on Vercel

Import the same GitHub repository into Vercel and configure:

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Add this environment variable in Vercel:

```env
VITE_API_URL=https://YOUR-BACKEND-SERVICE.onrender.com/api
```

Deploy the frontend. Then update the backend's `CLIENT_URL` on Render to the exact deployed Vercel origin and redeploy/restart the backend.

**Note:** The frontend API URL is embedded at build time. If it changes, trigger a new Vercel deployment.

## Environment variables and secrets

- `backend/.env` and `frontend/.env` are local-only files.
- `.env.example` files contain placeholders and may be committed.
- Never commit MongoDB credentials, JWT secrets, SMTP credentials, access tokens, or other private keys.
- Configure production secrets in Render/Vercel project settings, not in source code.

## Tests and checks

Backend:

```bash
cd backend
npm run check
npm test
```

Frontend:

```bash
cd frontend
npm run check
npm run build
```

## Documentation

Additional project documentation is available in the `docs/` directory, including:

- Core product workflow
- API reference
- Database reference
- Installation guide
- Testing guide
- Postman collection and usage guide
- Project report and submission guide
- Known limitations

## Project status

This repository contains the SmartRide student project source code. Before a public production launch, review hosting limits and third-party service terms, test all workflows on the deployed URLs, and configure appropriate monitoring and backups.
