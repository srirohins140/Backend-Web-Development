const service = require('../services/postService');
const http = require('../utils/http');

function listPosts(req, res) {
  const result = service.listPosts(req.query);
  return http.sendList(res, result.data, result.meta);
}

function getPost(req, res) {
  const post = service.getPost(req.params.id);
  if (!post) {
    return http.sendError(res, 404, 'NOT_FOUND', 'Post not found');
  }
  return http.sendOk(res, post);
}

function createPost(req, res) {
  try {
    const post = service.createPost(req.body);
    return http.sendCreated(res, post);
  } catch (err) {
    if (err.statusCode === 400) {
      return http.sendError(res, 400, 'VALIDATION_ERROR', err.message);
    }
    console.error('Failed to create post:', err.message);
    return http.sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}

function likePost(req, res) {
  const post = service.likePost(req.params.id);
  if (!post) {
    return http.sendError(res, 404, 'NOT_FOUND', 'Post not found');
  }
  return http.sendOk(res, post);
}

function explode(req, res) {
  try {
    service.explode();
    return http.sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
  } catch (err) {
    console.error('Internal failure demo caught:', err.message);
    return http.sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  likePost,
  explode
};
