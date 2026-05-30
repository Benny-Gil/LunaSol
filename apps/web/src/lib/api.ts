export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const { token, headers, ...rest } = options

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    // fetch() only rejects on network-level failures (offline, DNS, aborted).
    // Surface a human message instead of a raw "Failed to fetch".
    throw new Error('Network error — please check your connection and try again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `API error ${res.status}`)
  }

  // Tolerate empty / non-JSON success responses (e.g. 204 No Content) so
  // callers that don't expect a body don't blow up on res.json().
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
