import { Navigate, Outlet, useLocation } from "react-router-dom";
import { homePathFor, useAuth } from "../context/authStore";

// UI gating is a convenience only: every API call is still authorised on the server.
export default function ProtectedRoute({ roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
