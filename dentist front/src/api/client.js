/**
 * Error thrown for any non-2xx response. The API (like the Python SMS gateway)
 * answers with RFC 9457 problem details, so `problem.code` is available for
 * transport-level failures such as GATEWAY_UNREACHABLE.
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(problem, status) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code ?? problem?.title ?? 'REQUEST_FAILED';
    this.problem = problem ?? null;
  }
}

export async function apiFetch(path, { body, headers, ...options } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new ApiError(await readProblem(response), response.status);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? response.json() : null;
}

async function readProblem(response) {
  const fallback = { title: response.statusText || 'Request failed', status: response.status };

  try {
    const text = await response.text();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}
