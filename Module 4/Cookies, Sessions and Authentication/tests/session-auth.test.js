'use strict';

const assert = require('assert');
const http = require('http');
const app = require('../src/app');
const sessionStore = require('../src/session/sessionStore');
const userRepository = require('../src/repositories/userRepository');
const cookieSignature = require('cookie-signature');

let server;
let baseUrl;

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { ...headers };
    let payload = null;

    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          if (rawData) {
            try {
              parsed = JSON.parse(rawData);
            } catch {
              parsed = rawData;
            }
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Session Auth Test Suite ---');
  let passed = 0;
  let total = 0;

  function test(description, fn) {
    return (async () => {
      total++;
      try {
        await fn();
        console.log(`  ✓ ${description}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${description}`);
        console.error(err);
      }
    })();
  }

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  let authCookieHeader = '';
  let rawSessionId = '';

  try {
    await test('POST /auth/login with missing email/password returns 400', async () => {
      const res = await makeRequest('POST', '/auth/login', {}, {});
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body?.error?.code, 'INVALID_INPUT');
    });

    await test('POST /auth/login with empty password returns 400', async () => {
      const res = await makeRequest('POST', '/auth/login', {}, { email: 'sam@example.com', password: '   ' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body?.error?.code, 'INVALID_INPUT');
    });

    let wrongPasswordBody;
    await test('POST /auth/login with wrong password returns 401 generic error', async () => {
      const res = await makeRequest('POST', '/auth/login', {}, { email: 'sam@example.com', password: 'WrongPassword!' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'INVALID_CREDENTIALS');
      wrongPasswordBody = res.body;
    });

    let unknownEmailBody;
    await test('POST /auth/login with unknown email returns identical 401 generic error', async () => {
      const res = await makeRequest('POST', '/auth/login', {}, { email: 'nonexistent@example.com', password: 'SomePassword!' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'INVALID_CREDENTIALS');
      unknownEmailBody = res.body;
      assert.deepStrictEqual(wrongPasswordBody, unknownEmailBody, 'Error responses for unknown user and wrong password must be identical');
    });

    await test('POST /auth/login with valid credentials returns 200 with safe fields and sets signed cookie', async () => {
      const res = await makeRequest('POST', '/auth/login', {}, { email: 'sam@example.com', password: 'SessionDemo!48' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.email, 'sam@example.com');
      assert.strictEqual(res.body.name, 'Sam');
      assert.ok(res.body.id);
      assert.strictEqual(res.body.password, undefined);
      assert.strictEqual(res.body.passwordHash, undefined);

      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie, 'Set-Cookie header must be present');
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;

      assert.match(cookieStr, /^sid=s%3A/, 'Cookie must be named sid and signed (s: prefix)');
      assert.match(cookieStr, /HttpOnly/i, 'Cookie must have HttpOnly attribute');
      assert.match(cookieStr, /SameSite=Lax/i, 'Cookie must have SameSite=Lax attribute');
      assert.match(cookieStr, /Path=\//i, 'Cookie must have Path=/');
      assert.match(cookieStr, /Max-Age=\d+/i, 'Cookie must have Max-Age attribute');

      // Save cookie header for subsequent requests
      const cookieVal = cookieStr.split(';')[0];
      authCookieHeader = cookieVal;

      // Extract raw sessionId from signed cookie
      // Cookie value is URI encoded: sid=s%3A<id>.<sig>
      const match = cookieVal.match(/^sid=s%3A([^.]+)\./);
      assert.ok(match, 'Cookie must match signed format');
      rawSessionId = decodeURIComponent(match[1]);
      assert.ok(sessionStore.get(rawSessionId), 'Server session store must have a live record for the session id');
    });

    await test('GET /auth/me without cookie returns 401 AUTH_REQUIRED', async () => {
      const res = await makeRequest('GET', '/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
    });

    await test('GET /auth/me with unsigned cookie returns 401 AUTH_REQUIRED', async () => {
      const res = await makeRequest('GET', '/auth/me', { Cookie: `sid=${rawSessionId}` });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
    });

    await test('GET /auth/me with tampered signature returns 401 AUTH_REQUIRED', async () => {
      const tamperedCookie = authCookieHeader.slice(0, -5) + 'xxxxx';
      const res = await makeRequest('GET', '/auth/me', { Cookie: tamperedCookie });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
    });

    await test('GET /auth/me with valid signed cookie returns 200 with identity', async () => {
      const res = await makeRequest('GET', '/auth/me', { Cookie: authCookieHeader });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.email, 'sam@example.com');
      assert.strictEqual(res.body.name, 'Sam');
      assert.ok(res.body.id);
      assert.strictEqual(res.body.password, undefined);
      assert.strictEqual(res.body.passwordHash, undefined);
    });

    await test('GET /auth/me with expired session returns 401 AUTH_REQUIRED and prunes session', async () => {
      // Create an expired session
      const expiredSession = sessionStore.create(1, -1000); // expired 1s ago
      const signedVal = 's:' + cookieSignature.sign(expiredSession.id, process.env.COOKIE_SECRET);
      const expiredCookie = `sid=${encodeURIComponent(signedVal)}`;

      const res = await makeRequest('GET', '/auth/me', { Cookie: expiredCookie });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
      assert.strictEqual(sessionStore.get(expiredSession.id), null, 'Expired session must be pruned');
    });

    await test('GET /auth/me with orphaned session (deleted user) destroys session and returns 401 AUTH_REQUIRED', async () => {
      // Create session for non-existent userId
      const orphanSession = sessionStore.create(999999);
      const signedVal = 's:' + cookieSignature.sign(orphanSession.id, process.env.COOKIE_SECRET);
      const orphanCookie = `sid=${encodeURIComponent(signedVal)}`;

      const res = await makeRequest('GET', '/auth/me', { Cookie: orphanCookie });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
      assert.strictEqual(sessionStore.get(orphanSession.id), null, 'Orphaned session must be destroyed');
    });

    await test('POST /auth/logout destroys server session and clears cookie with 204', async () => {
      const res = await makeRequest('POST', '/auth/logout', { Cookie: authCookieHeader });
      assert.strictEqual(res.status, 204);

      // Verify Set-Cookie clears the cookie
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie, 'Logout must send clearing Set-Cookie');
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      assert.match(cookieStr, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i, 'Clearing cookie must expire in the past');
      assert.match(cookieStr, /HttpOnly/i, 'Clearing cookie must maintain HttpOnly');
      assert.match(cookieStr, /SameSite=Lax/i, 'Clearing cookie must maintain SameSite=Lax');
      assert.match(cookieStr, /Path=\//i, 'Clearing cookie must maintain Path=/');

      // Server session authority must be revoked immediately
      assert.strictEqual(sessionStore.get(rawSessionId), null, 'Server session must be deleted from store');
    });

    await test('GET /auth/me after logout with old cookie returns 401 (replaying fails)', async () => {
      const res = await makeRequest('GET', '/auth/me', { Cookie: authCookieHeader });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'AUTH_REQUIRED');
    });

    await test('POST /auth/logout is idempotent and safe to repeat with 204', async () => {
      const res = await makeRequest('POST', '/auth/logout', { Cookie: authCookieHeader });
      assert.strictEqual(res.status, 204);

      const res2 = await makeRequest('POST', '/auth/logout');
      assert.strictEqual(res2.status, 204);
    });

    await test('COOKIE_SECURE=true sets Secure attribute on cookie', async () => {
      process.env.COOKIE_SECURE = 'true';
      try {
        const res = await makeRequest('POST', '/auth/login', {}, { email: 'sam@example.com', password: 'SessionDemo!48' });
        assert.strictEqual(res.status, 200);
        const setCookie = res.headers['set-cookie'];
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        assert.match(cookieStr, /Secure/i, 'Cookie must have Secure attribute when COOKIE_SECURE is true');
      } finally {
        process.env.COOKIE_SECURE = 'false';
      }
    });

  } finally {
    server.close();
  }

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
