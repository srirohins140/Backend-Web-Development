function sendList(res, rows, meta) {
  if (rows && typeof rows === 'object' && !Array.isArray(rows) && rows.data) {
    return res.status(200).json({
      data: rows.data,
      meta: rows.meta || meta
    });
  }

  return res.status(200).json({
    data: rows,
    meta
  });
}

function sendCreated(res, post) {
  return res.status(201).json({
    data: post
  });
}

function sendOk(res, payload) {
  return res.status(200).json({
    data: payload
  });
}

function sendError(res, status, codeOrPayload, maybeMessage) {
  let code;
  let message;

  if (typeof codeOrPayload === 'string' && typeof maybeMessage === 'string') {
    code = codeOrPayload;
    message = maybeMessage;
  } else if (typeof codeOrPayload === 'string') {
    code = status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    message = codeOrPayload;
  } else if (typeof codeOrPayload === 'object' && codeOrPayload !== null) {
    code = codeOrPayload.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');
    message = codeOrPayload.message || (status === 404 ? 'Resource not found' : status === 400 ? 'Invalid request' : 'Something went wrong');
  } else {
    code = status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    message = status === 404 ? 'Resource not found' : status === 400 ? 'Invalid request' : 'Something went wrong';
  }

  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}

module.exports = {
  sendList,
  sendCreated,
  sendOk,
  sendError
};
