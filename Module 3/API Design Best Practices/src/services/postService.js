const store = require('../data/postStore');

const DEFAULT_LIMIT = 2;
const MAX_LIMIT = 50;

function listPosts(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const parsedLimit = parseInt(query.limit, 10);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const allPosts = store.getAllPosts();
  const total = allPosts.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = allPosts.slice(start, start + limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      pages,
      totalPages: pages,
      hasNextPage: page < pages,
      hasPreviousPage: page > 1
    }
  };
}

function getPost(id) {
  return store.getPostById(id);
}

function createPost(body = {}) {
  if (
    !body.title || typeof body.title !== 'string' || !body.title.trim() ||
    !body.author || typeof body.author !== 'string' || !body.author.trim()
  ) {
    const err = new Error('Title and author are required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return store.createPost({
    title: body.title.trim(),
    author: body.author.trim()
  });
}

function likePost(id) {
  return store.incrementLikes(id);
}

function explode() {
  const err = new Error('Simulated internal failure');
  err.statusCode = 500;
  err.code = 'INTERNAL_ERROR';
  throw err;
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  likePost,
  explode
};
