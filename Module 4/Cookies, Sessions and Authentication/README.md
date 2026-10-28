# Session Authentication API (Express & Prisma)

An Express and Prisma REST API implementing secure session-based authentication. Login creates a server-side session mapping and issues an unpredictable, opaque identifier transported via a signed, protected HTTP-only cookie. Protected endpoints resolve user identity exclusively through the server-side session store, and logout revokes authority on both sides.

---

## Architecture & Security Model

```
[ Browser Cookie Jar ]                          [ Express API & Server Store ]
  sid=s%3A<opaque-uuid>.<signature>  -------->  Verify HMAC Signature (COOKIE_SECRET)
                                                Resolve Session: <opaque-uuid> -> { userId, expiresAt }
                                                Prune if Date.now() > expiresAt
                                                Fetch Identity: User (id, name, email) via Repository
```

### 1. Two Linked Halves
- **Opaque Reference**: The cookie value contains only a cryptographically random UUID (`crypto.randomUUID()`) and an HMAC signature. It never contains user IDs, emails, roles, plaintext passwords, or password hashes.
- **Server Authority**: User identity exists only on the server. The server resolves credentials and maps the session ID to `{ userId, expiresAt }`.

### 2. Centralized Cookie Configuration
Cookie attributes are centralized in `src/config/cookie.js` to prevent configuration drift between issuance (`login`) and revocation (`logout`):
- `httpOnly: true`: Prevents client-side scripts (`document.cookie`) from accessing the session identifier, mitigating XSS token theft.
- `sameSite: 'lax'`: Protects against Cross-Site Request Forgery (CSRF) for state-changing cross-origin requests while preserving standard top-level navigation.
- `secure: process.env.COOKIE_SECURE === 'true'`: Enforces HTTPS-only transmission in production. Configurable for local HTTP testing.
- `signed: true`: Signs the cookie using `COOKIE_SECRET` to immediately detect and reject client tampering.
- `path: '/'`: Restricts and scopes the cookie across all API routes.
- `maxAge`: Synchronized with the server-side `SESSION_TTL_MS` (default: 1 hour).

### 3. Repository and Store Boundaries
- **User Repository (`src/repositories/userRepository.js`)**: Encapsulates all Prisma database operations (`findByEmail`, `findById`, `findPublicById`). Routes and middleware never interact directly with Prisma models.
- **Session Store (`src/session/sessionStore.js`)**: Encapsulates session creation, expiration pruning, and destruction.
- **Safe Serializer (`src/utils/userSerializer.js`)**: Enforces an explicit field allowlist (`id`, `name`, `email`), ensuring sensitive fields like `passwordHash` are never serialized.

### 4. Production Storage Note
The default session store uses an in-memory `Map`. This is suitable for local development, testing, and single-process learning environments only:
- Memory state does not survive server restarts.
- Multiple Node.js cluster processes or horizontally scaled container instances cannot share memory.
- In production, replace the in-memory Map with a distributed shared store such as **Redis** or **KeyDB** with native key TTL expiration.

---

## Setup & Running

### 1. Environment Configuration

Copy the example environment file and configure environment variables:

```bash
cp .env.example .env
```

Ensure `.env` contains:
- `DATABASE_URL="file:./dev.db"`
- `COOKIE_SECRET`: At least 32 random characters (never committed to version control).
- `COOKIE_SECURE="false"` (set to `"true"` in production behind HTTPS).
- `SESSION_TTL_MS="3600000"` (session time-to-live in milliseconds; default 1 hour).
- `PORT="3000"`

### 2. Install Dependencies & Initialize Database

```bash
npm install
npm run setup
```

The `setup` script runs Prisma client generation, schema migration (`prisma db push`), and seeds the demo account:
- **Email**: `sam@example.com`
- **Password**: `SessionDemo!48`

### 3. Run the API Server

```bash
# Development mode with watch:
npm run dev

# Production / standard start:
npm start
```

### 4. Run Automated Test Suite

```bash
npm test
```

---

## API Endpoints

### 1. `POST /auth/login`
Authenticates credentials, initializes server session, sets signed cookie, and returns safe user fields.

- **Request Body**:
  ```json
  {
    "email": "sam@example.com",
    "password": "SessionDemo!48"
  }
  ```
- **Responses**:
  - `200 OK`: Sets `sid` cookie (`HttpOnly; SameSite=Lax; Path=/; Max-Age=...`) and returns:
    ```json
    {
      "id": 1,
      "name": "Sam",
      "email": "sam@example.com"
    }
    ```
  - `400 Bad Request`: Missing, non-string, or empty email/password.
  - `401 Unauthorized`: Generic `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` for both unknown email and wrong password to prevent user enumeration.

### 2. `GET /auth/me`
Protected route that verifies the signed session cookie and retrieves identity.

- **Headers**: `Cookie: sid=s%3A...`
- **Responses**:
  - `200 OK`: Returns authenticated safe identity fields:
    ```json
    {
      "id": 1,
      "name": "Sam",
      "email": "sam@example.com"
    }
    ```
  - `401 Unauthorized`: Returns generic `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required" } }` when cookie is missing, signature is tampered, session is expired, session ID is unknown, or user is deleted.

### 3. `POST /auth/logout`
Revokes server-side session authority and instructs the client to expire the cookie.

- **Headers**: `Cookie: sid=s%3A...`
- **Responses**:
  - `204 No Content`: Clears `sid` cookie with matching options (`Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`).
  - Idempotent: repeated logout requests safely return `204`.

---

## Local Verification with `curl`

Verify the complete session lifecycle from your terminal:

### 1. Successful Login & Cookie Storage
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sam@example.com","password":"SessionDemo!48"}' \
  -c cookies.txt
```
*Expected*: HTTP 200, `Set-Cookie: sid=s%3A...; Path=/; HttpOnly; SameSite=Lax`, and safe user JSON (`id`, `name`, `email`).

### 2. Protected Request Using Stored Cookie
```bash
curl -i -X GET http://localhost:3000/auth/me \
  -b cookies.txt
```
*Expected*: HTTP 200 with `{ "id": 1, "name": "Sam", "email": "sam@example.com" }`.

### 3. Request Without Cookie
```bash
curl -i -X GET http://localhost:3000/auth/me
```
*Expected*: HTTP 401 `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required" } }`.

### 4. Request With Tampered Cookie
```bash
curl -i -X GET http://localhost:3000/auth/me \
  -H "Cookie: sid=s%3Afake-session-id.invalid-signature"
```
*Expected*: HTTP 401 `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required" } }`.

### 5. Logout & Server Revocation
```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```
*Expected*: HTTP 204 No Content with clearing `Set-Cookie` (`Expires=Thu, 01 Jan 1970 00:00:00 GMT`).

### 6. Verify Replay Attempt Fails
```bash
curl -i -X GET http://localhost:3000/auth/me \
  -b cookies.txt
```
*Expected*: HTTP 401 `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required" } }`. Proves server-side record was destroyed.
