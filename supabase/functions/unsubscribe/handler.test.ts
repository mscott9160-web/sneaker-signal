import { describe, expect, it, vi } from "vitest";
import { handleUnsubscribe, isUnsubscribeToken } from "./handler";

const token = "3f1c2b4a-9d8e-4c7b-a6f5-1e2d3c4b5a69";
const url = (query: string) => `https://project.supabase.co/functions/v1/unsubscribe${query}`;

describe("one-click unsubscribe endpoint", () => {
  it("unsubscribes on the RFC 8058 POST", async () => {
    const unsubscribe = vi.fn().mockResolvedValue({ error: null });
    const response = await handleUnsubscribe(
      new Request(url(`?token=${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
      unsubscribe,
    );
    expect(response.status).toBe(200);
    expect(unsubscribe).toHaveBeenCalledWith(token);
  });

  it("never unsubscribes on GET, so link scanners can't trigger it", async () => {
    const unsubscribe = vi.fn();
    const response = await handleUnsubscribe(new Request(url(`?token=${token}`)), unsubscribe);
    expect(response.status).toBe(405);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("rejects missing or malformed tokens without touching the database", async () => {
    const unsubscribe = vi.fn();
    for (const query of ["", "?token=", "?token=abc", "?token=' or 1=1 --"]) {
      const response = await handleUnsubscribe(
        new Request(url(query), { method: "POST" }),
        unsubscribe,
      );
      expect(response.status).toBe(400);
    }
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("reports a temporary failure when the database errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleUnsubscribe(
      new Request(url(`?token=${token}`), { method: "POST" }),
      vi.fn().mockResolvedValue({ error: "connection refused" }),
    );
    expect(response.status).toBe(503);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(token);
    consoleError.mockRestore();
  });

  it("recognises token format", () => {
    expect(isUnsubscribeToken(token)).toBe(true);
    expect(isUnsubscribeToken(token.toUpperCase())).toBe(true);
    expect(isUnsubscribeToken(null)).toBe(false);
    expect(isUnsubscribeToken(`${token}x`)).toBe(false);
  });
});
