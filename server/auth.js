const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'tm_session';
const TOKEN_TTL = '7d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET environment variable.');
  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign({
    sub: user.id, email: user.email, phone: user.phone, name: user.name || null,
    role: user.role || 'admin', managedCommunityEnterpriseId: user.managedCommunityEnterpriseId || null
  }, getSecret(), { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

function setSessionCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin role required' });
    next();
  });
}

function requireAdminOrEnterpriseAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'enterprise_admin') {
      return res.status(403).json({ error: 'admin or enterprise_admin role required' });
    }
    next();
  });
}

module.exports = {
  COOKIE_NAME, hashPassword, comparePassword, signToken, verifyToken,
  setSessionCookie, clearSessionCookie, requireAuth, requireAdmin, requireAdminOrEnterpriseAdmin
};
