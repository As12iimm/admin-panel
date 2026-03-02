const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const Session = require('../models/Session');
const User = require('../models/User');
const { permissionsForRole } = require('../permissions');

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload.type !== 'access') return res.status(401).json({ message: 'Invalid token type' });

    const [session, user] = await Promise.all([
      Session.findById(payload.sid),
      User.findById(payload.id)
    ]);

    if (!user || !user.active) return res.status(401).json({ message: 'User inactive' });
    if (!session || session.revokedAt) return res.status(401).json({ message: 'Session revoked' });
    if (user.tokenVersion !== payload.tokenVersion) return res.status(401).json({ message: 'Token expired' });

    req.user = {
      id: String(user._id),
      role: user.role,
      email: user.email,
      branchIds: user.branchIds,
      assignedPackageIds: user.assignedPackageIds?.map(String) || [],
      permissions: permissionsForRole(user.role),
      sid: String(session._id)
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function allowAction(action) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(action)) {
      return res.status(403).json({ message: 'Missing permission', action });
    }
    next();
  };
}

module.exports = { authRequired, allowRoles, allowAction };
