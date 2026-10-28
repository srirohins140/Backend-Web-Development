const prisma = require('../db/prisma');

/**
 * Isolates all Prisma operations for the User entity.
 */

async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

async function createUser({ name, email, passwordHash }) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });
}

module.exports = {
  findByEmail,
  findById,
  createUser,
};
