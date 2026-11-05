import { io } from "socket.io-client";
import { SOCKET_URL, getToken } from "../services/api";

// One authenticated connection per browser tab. The token is read at connect time; the server closes the socket when
// the JWT expires, and the session layer logs the user out at the same moment.
let socket = null;

export function getSocket() {
  const token = getToken();
  if (!token) return null;
  if (!socket) {
    socket = io(SOCKET_URL, { auth: (cb) => cb({ token: getToken() }), transports: ["websocket", "polling"], reconnectionDelayMax: 8000 });
  }
  return socket;
}

export function closeSocket() {
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
}

// Promise wrapper for acknowledged events. Rejects with the server's error message.
export function emitAck(event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s || !s.connected) return reject(new Error("Real-time connection is not available"));
    s.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) return reject(new Error("The server did not respond in time"));
      if (!res || !res.ok) return reject(new Error((res && res.error) || "Request failed"));
      resolve(res);
    });
  });
}
