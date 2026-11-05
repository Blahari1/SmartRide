import { api } from "./api";

export const getMyProfile = () => api("/profile/me");
export const updateMyProfile = (profile) => api("/profile/me", { method: "PUT", body: profile });
