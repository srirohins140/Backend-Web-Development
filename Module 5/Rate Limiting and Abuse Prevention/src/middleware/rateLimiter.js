'use strict';
// middleware/rateLimiter.js
//
// Strict rate limiter for authentication routes using express-rate-limit.
//
// ============================================================================
// Multi-Instance Deployment & Redis Store Explanation:
// ============================================================================
// Why the in-memory store fails across multiple instances:
// By default, express-rate-limit uses MemoryStore, which stores hit counts in the
// local memory of the single Node.js process. When an application is deployed in
// production across multiple instances behind a load balancer (horizontal scaling),
// each instance maintains its own isolated counter in its own process memory.
//
// Consequently, if a client is configured to be blocked after 5 failed attempts,
// but traffic is distributed across 3 instances, the client could make up to 15
// attempts (5 on instance A, 5 on instance B, 5 on instance C) before being blocked
// on any single instance. This multiplies the threshold by the instance count and
// undermines brute-force protection.
//
// How Redis-backed store (rate-limit-redis) solves this:
// A Redis-backed store moves the rate limit counter out of process memory and
// into a centralized, shared Redis instance/cluster. All Node.js application
// instances query and atomically update the same Redis keys.
//
// Example implementation:
//   const { RedisStore } = require('rate-limit-redis');
//   const { createClient } = require('redis');
//
//   const redisClient = createClient({ url: process.env.REDIS_URL });
//   redisClient.connect().catch(console.error);
//
//   const authLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 5,
//     standardHeaders: true,
//     legacyHeaders: false,
//     skipSuccessfulRequests: true,
//     store: new RedisStore({
//       sendCommand: (...args) => redisClient.sendCommand(args),
//     }),
//   });
//
// With RedisStore, every instance checks and increments the exact same counter,
// ensuring that the 5-attempt limit is strictly enforced across the entire cluster.
// ============================================================================

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // 5 attempts per window per IP
  skipSuccessfulRequests: true, // only failed attempts count; successful logins never burn quota
  standardHeaders: true, // return RateLimit-* and Retry-After headers in response
  legacyHeaders: false, // disable X-RateLimit-* headers
  message: {
    error: 'Too many requests, please try again later.'
  }
});

module.exports = authLimiter;
