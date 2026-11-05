const MAIL_API_URL = process.env['MAIL_API_URL'] ?? 'http://127.0.0.1:54324';
const POLL_INTERVAL_MS = 250;

interface MessageSummary {
  readonly ID: string;
}

interface SearchResult {
  readonly messages: readonly MessageSummary[];
}

interface Message {
  readonly Text: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAIL_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mail catcher answered ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

/** Waits for the latest email sent to `address` and returns its 6-digit one-time code. */
export async function latestOtpCode(address: string, timeoutMs = 10_000): Promise<string> {
  const query = encodeURIComponent(`to:"${address}"`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { messages } = await fetchJson<SearchResult>(`/api/v1/search?query=${query}&limit=1`);
    const latest = messages[0];
    if (latest) {
      const { Text } = await fetchJson<Message>(`/api/v1/message/${latest.ID}`);
      const code = /\b\d{6}\b/.exec(Text)?.[0];
      if (code) {
        return code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`No one-time code arrived for ${address} within ${timeoutMs} ms`);
}
