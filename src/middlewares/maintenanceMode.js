export function maintenanceMode(req, res, next) {
  if (process.env.MAINTENANCE === "true" && req.path !== "/api/status") {
    return res.status(503).json({ maintenance: true });
  }
  next();
}
