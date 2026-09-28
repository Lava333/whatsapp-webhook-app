/**
 * auth.js — Authentication middleware
 * Protects /dashboard and /api routes.
 * Webhook endpoint (/whatsapp/webhook) is intentionally left open (Meta needs access).
 */

/**
 * requireLogin — attach to any route that needs authentication.
 * If not logged in: API calls get 401, browser requests redirect to /login.
 */
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  // API calls → return 401 JSON
  if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/api')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
  }
  // Browser → redirect to login page with return URL
  const returnTo = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?returnTo=${returnTo}`);
}

module.exports = { requireLogin };
