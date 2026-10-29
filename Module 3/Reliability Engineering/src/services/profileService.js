const DEFAULT_AVATAR = {
  url: 'https://cdn.aurora-profiles.dev/avatars/default.png',
  initials: '?',
  source: 'fallback',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;

  const rawStatus = error.status ?? error.statusCode ?? error.response?.status;
  if (rawStatus !== undefined && rawStatus !== null) {
    const status = Number(rawStatus);
    if (!Number.isNaN(status) && status > 0) {
      if (status === 429) return true;
      if (status >= 500 && status < 600) return true;
      return false;
    }
  }

  // Network errors (no status)
  return true;
}

async function withTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(operation, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs !== undefined ? options.baseDelayMs : 25;

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await sleep(baseDelayMs * (2 ** attempt));
    }
  }

  throw lastError;
}

async function getProfileWithAvatar(authorId, avatarClient, options = {}) {
  const timeoutMs = options.timeoutMs || 200;
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 25;

  try {
    const avatar = await withRetry(
      () => withTimeout(signal => avatarClient.getAvatar(authorId, { signal }), timeoutMs),
      { maxAttempts, baseDelayMs }
    );
    return { authorId, avatar, degraded: false };
  } catch (error) {
    return { authorId, avatar: DEFAULT_AVATAR, degraded: true };
  }
}

module.exports = {
  DEFAULT_AVATAR,
  sleep,
  isRetryable,
  withTimeout,
  withRetry,
  getProfileWithAvatar,
};
