'use strict';

const prisma = require('../db/prisma');

/**
 * Isolates all Prisma operations for the User entity behind repository functions.
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

async function findPublicById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

module.exports = {
  findByEmail,
  findById,
  findPublicById,
};
