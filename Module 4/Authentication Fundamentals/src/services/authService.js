const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');

// Explicit safe-field allowlist for user serialization
const SAFE_FIELDS = ['id', 'name', 'email'];

function toSafeUser(user) {
  if (!user) return null;
  const safe = {};
  for (const field of SAFE_FIELDS) {
    if (field in user) {
      safe[field] = user[field];
    }
  }
  return safe;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function register({ name, email, password }) {
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new AuthError(400, 'INVALID_INPUT', 'Name, email, and password must be non-empty strings');
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedName = name.trim();

  // Check whether normalized email already exists
  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new AuthError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists');
  }

  // Hash password using asynchronous bcryptjs before persistence
  const cost = Number(process.env.BCRYPT_COST) || 12;
  const passwordHash = await bcrypt.hash(password, cost);

  try {
    const user = await userRepository.createUser({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
    });
    return toSafeUser(user);
  } catch (error) {
    // Handle database-level unique constraint collision gracefully
    if (error && error.code === 'P2002') {
      throw new AuthError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists');
    }
    throw error;
  }
}

async function login({ email, password }) {
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new AuthError(400, 'INVALID_INPUT', 'Email and password must be non-empty strings');
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return toSafeUser(user);
}

module.exports = {
  register,
  login,
  toSafeUser,
  normalizeEmail,
  AuthError,
};
