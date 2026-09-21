/* Sends a real request to an endpoint and measures it. Handles JSON, text and
   image responses (the Blue Archive endpoint returns a PNG). */

const STATUS_TEXT = {
  200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Request Timeout',
  429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const TIMEOUT_MS = 60000;

export async function runRequest(url, headers = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  let response;
  try {
    response = await fetch(url, { headers: Object.fromEntries(headers), signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    const timedOut = error && error.name === 'AbortError';
    return {
      ok: false,
      networkError: true,
      message: timedOut ? `The request timed out after ${TIMEOUT_MS / 1000} seconds.` : 'Could not reach the server. Check your connection and try again.',
      ms: performance.now() - started,
      url,
    };
  }

  const contentType = response.headers.get('content-type') || '';
  const result = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText || STATUS_TEXT[response.status] || '',
    contentType: contentType.split(';')[0],
    url,
  };

  try {
    if (contentType.startsWith('image/')) {
      const blob = await response.blob();
      Object.assign(result, { kind: 'image', size: blob.size, blobUrl: URL.createObjectURL(blob) });
    } else {
      const text = await response.text();
      result.size = new TextEncoder().encode(text).length;
      try {
        result.body = JSON.parse(text);
        result.kind = 'json';
        result.text = JSON.stringify(result.body, null, 2);
      } catch {
        result.body = text;
        result.kind = 'text';
        result.text = text;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  result.ms = performance.now() - started;
  return result;
}
