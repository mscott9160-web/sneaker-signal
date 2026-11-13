// RFC 8058 one-click unsubscribe endpoint.
//
// Mail clients (Gmail, Yahoo, Apple Mail) send
//   POST <List-Unsubscribe URL>   body: List-Unsubscribe=One-Click
// when someone uses their built-in "Unsubscribe" button. The token travels in the
// query string. GET is refused on purpose: link scanners fetch every URL in an email,
// and a GET must never unsubscribe anyone. People who click the link in the email body
// land on the /unsubscribe page in the web app instead, which asks them to confirm.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUnsubscribeToken(value: string | null): value is string {
  return value !== null && uuidPattern.test(value);
}

export type UnsubscribeFn = (token: string) => Promise<{ error: string | null }>;

const plain = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

export async function handleUnsubscribe(request: Request, unsubscribe: UnsubscribeFn) {
  if (request.method !== "POST") return plain("Method not allowed", 405, { Allow: "POST" });

  const token = new URL(request.url).searchParams.get("token");
  if (!isUnsubscribeToken(token)) return plain("Invalid unsubscribe link", 400);

  const { error } = await unsubscribe(token);
  if (error) {
    // Logged without the token so a log reader cannot replay it.
    console.error("unsubscribe failed", { category: "database" });
    return plain("Unsubscribe is temporarily unavailable", 503);
  }

  // Unknown tokens also get 200 so the endpoint does not reveal which tokens exist.
  return plain("You have been unsubscribed from Sneaker Signal emails.", 200);
}
