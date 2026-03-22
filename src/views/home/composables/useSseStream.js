const parseSseEvent = (rawEvent) => {
  const lines = rawEvent.split('\n')
  let event = 'message'
  const dataLines = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    if (!line || line.startsWith(':')) continue

    const colonIndex = line.indexOf(':')
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).trimStart()

    if (field === 'event') {
      event = value || 'message'
      continue
    }

    if (field === 'data') {
      dataLines.push(value)
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  }
}

const safeParsePayload = (payload) => {
  if (!payload) return ''
  const trimmed = payload.trim()
  if (!trimmed) return ''
  if (trimmed === '[DONE]') return '[DONE]'

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  return trimmed
}

export const sendSseStream = async ({
  url,
  method = 'POST',
  headers = {},
  body,
  signal,
  onMessage,
  onDone,
}) => {
  const apiKey = localStorage.getItem('x-api-key')?.trim()
  const defaultHeaders = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    defaultHeaders['x-api-key'] = apiKey
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Stream request failed (${response.status})`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('ReadableStream not supported in current response')
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const rawEvent of events) {
      const { event, data } = parseSseEvent(rawEvent)
      const payload = safeParsePayload(data)
      if (payload === '' || payload == null) continue

      if (payload === '[DONE]' || event === 'done') {
        onDone?.()
        continue
      }

      onMessage?.(payload, event)
    }
  }

  if (buffer.trim()) {
    const { event, data } = parseSseEvent(buffer)
    const payload = safeParsePayload(data)
    if (payload && payload !== '[DONE]' && event !== 'done') {
      onMessage?.(payload, event)
    }
  }

  onDone?.()
}
