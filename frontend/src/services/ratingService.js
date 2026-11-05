import { api, qs } from "./api";

export const submitRating = (tripId, rating, feedback) => api("/ratings", { method: "POST", body: { tripId, rating, ...(feedback ? { feedback } : {}) } });
export const myRatings = () => api("/ratings/my");
export const driverRatings = (params) => api(`/ratings/driver/my${qs(params)}`);
export const listRatings = (params) => api(`/ratings${qs(params)}`);
