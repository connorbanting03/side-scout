// API Configuration
// In production, the Flask server serves both the API and the frontend on the same origin.
// For local dev with `next dev`, point at the Flask backend directly.

// Check if we're in development (next dev) or production (static export served by Flask)
const isDev = process.env.NODE_ENV === 'development';

// In dev mode, detect if we're accessing from network or localhost
// and call Flask backend on the appropriate address
function getDevApiUrl() {
  if (typeof window === 'undefined') {
    // Server-side rendering - use localhost
    return 'http://localhost:5000';
  }
  
  // Client-side - use same hostname as frontend to work on mobile/network
  const hostname = window.location.hostname;
  
  // If accessing via network IP (not localhost), use that IP for backend too
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:5000`;
  }
  
  return 'http://localhost:5000';
}

// In dev mode, call Flask backend directly on port 5000 (with dynamic hostname)
// In production, use same-origin (empty string) since Flask serves everything
export const API_BASE_URL = isDev ? getDevApiUrl() : '';
