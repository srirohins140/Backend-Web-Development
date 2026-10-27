/**
 * Post Repository (In-Memory Map-backed Implementation)
 *
 * ARCHITECTURAL BOUNDARY & PRISMA MIGRATION OVERVIEW:
 * ----------------------------------------------------
 * This repository serves as a stable abstraction boundary between the domain service layer
 * (business logic) and the underlying data storage mechanism.
 *
 * STORAGE-SWAP PROOF:
 * The internal storage implementation has been transitioned from an array-backed store
 * to a Map-backed store (`new Map()`). Because the service layer depends strictly upon
 * the repository contract (findAll, findById, create, update, remove), the service layer
 * continues to function seamlessly with zero modifications.
 *
 * FUTURE PRISMA-BACKED IMPLEMENTATION:
 * When this in-memory Map implementation is replaced with a database backed by Prisma ORM:
 *
 * WHAT WILL CHANGE:
 * 1. Asynchronous Signatures:
 *    - All repository methods (`findAll`, `findById`, `create`, `update`, `remove`) will
 *      become `async` and return Promises, reflecting the asynchronous I/O nature of database queries.
 *    - Service layer callers and controllers will use `await` to handle these asynchronous operations.
 * 2. Underlying Storage Engine:
 *    - The in-memory `Map` data structure and in-memory `nextId` counter will be removed.
 *    - Queries will execute against a database (e.g., PostgreSQL, MySQL, or SQLite) via `prisma.post.*`.
 * 3. Identity Generation:
 *    - ID generation will be handled by the database engine (e.g., auto-incrementing integer or UUID)
 *      defined in the Prisma schema (`@id @default(autoincrement())`), rather than manual incrementing in memory.
 * 4. Internal Query Implementation:
 *    - `findAll()` will execute `await prisma.post.findMany()`.
 *    - `findById(id)` will execute `await prisma.post.findUnique({ where: { id: Number(id) } })`.
 *    - `create(fields)` will execute `await prisma.post.create({ data: fields })`.
 *    - `update(id, patch)` will execute `await prisma.post.update({ where: { id: Number(id) }, data: patch })`.
 *    - `remove(id)` will execute `await prisma.post.delete({ where: { id: Number(id) } })`
 *      (with error handling for record-not-found / Prisma P2025 code).
 *
 * WHAT WILL REMAIN UNCHANGED:
 * 1. Stable Contract & Standard Operations:
 *    - The repository boundary will continue to expose the exact same five standard operations:
 *      `findAll()`, `findById(id)`, `create(fields)`, `update(id, patch)`, and `remove(id)`.
 * 2. Architectural Boundary & Separation of Concerns:
 *    - The service layer will remain strictly decoupled from data storage, SQL queries, table schemas,
 *      and Prisma Client specifics.
 * 3. Domain Rules & Business Validation:
 *    - Business logic (such as input validation, required fields, and domain status checks) will
 *      remain located entirely in the service layer, not leaked into the repository.
 * 4. Return Shapes & Semantic Guarantees:
 *    - `findAll()` returns a collection of post records.
 *    - `findById(id)` returns a post record or `null` if not found.
 *    - `create(fields)` returns the complete created record including its assigned ID.
 *    - `update(id, patch)` returns the updated record or `null` if not found.
 *    - `remove(id)` returns a boolean (`true` if deleted, `false` if not found).
 * 5. Controller & Route Contracts:
 *    - HTTP controllers and routes will continue to interact only with the service layer,
 *      maintaining existing request/response formats and HTTP status codes.
 */

// Storage-swap proof: In-memory store backed by a JavaScript Map
const posts = new Map([
  [1, { id: 1, title: 'First post', body: 'Repository boundaries protect change.', authorId: 7 }],
  [2, { id: 2, title: 'Second post', body: 'Services should speak in domain language.', authorId: 8 }],
]);

let nextId = 3;

function findAll() {
  return Array.from(posts.values()).map((post) => ({ ...post }));
}

function findById(id) {
  const post = posts.get(Number(id));
  if (!post) return null;
  return { ...post };
}

function create(fields = {}) {
  const id = nextId++;
  const post = {
    id,
    title: fields.title,
    body: fields.body || '',
    authorId: fields.authorId,
    ...fields,
    id, // Ensure generated id cannot be overridden
  };
  posts.set(id, post);
  return { ...post };
}

function update(id, patch = {}) {
  const numericId = Number(id);
  const existing = posts.get(numericId);
  if (!existing) return null;

  const updated = { ...existing };
  if (patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (key !== 'id' && value !== undefined) {
        updated[key] = value;
      }
    }
  }
  posts.set(numericId, updated);
  return { ...updated };
}

function remove(id) {
  const numericId = Number(id);
  return posts.delete(numericId);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
