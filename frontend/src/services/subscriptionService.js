import { api, qs } from "./api";

// plans
export const listPlans = () => api("/subscription-plans", { auth: false });
export const listAllPlans = () => api("/subscription-plans/admin");
export const createPlan = (plan) => api("/subscription-plans", { method: "POST", body: plan });
export const updatePlan = (id, plan) => api(`/subscription-plans/${id}`, { method: "PATCH", body: plan });
export const setPlanActive = (id, isActive) => api(`/subscription-plans/${id}/status`, { method: "PATCH", body: { isActive } });

// customer subscriptions (price and dates are never sent: the server computes them)
export const requestSubscription = (planId, commute = {}) => api("/subscriptions", { method: "POST", body: { planId, ...commute } });
export const mySubscriptions = () => api("/subscriptions/my");
export const getSubscription = (id) => api(`/subscriptions/${id}`);
export const cancelSubscription = (id) => api(`/subscriptions/${id}/cancel`, { method: "POST", body: {} });

// admin
export const listSubscriptions = (params) => api(`/subscriptions${qs(params)}`);
