import { describe, expect, it } from "vitest";
import { getRoute } from "./routes";

describe("routes", () => {
  it("maps known paths, tolerating trailing slashes", () => {
    expect(getRoute("/")).toBe("home");
    expect(getRoute("/settings/notifications")).toBe("notifications");
    expect(getRoute("/settings/notifications/")).toBe("notifications");
    expect(getRoute("/privacy")).toBe("privacy");
    expect(getRoute("/terms")).toBe("terms");
  });

  it("treats anything else as not found", () => {
    expect(getRoute("/settings")).toBe("not-found");
    expect(getRoute("/privacy/extra")).toBe("not-found");
  });
});
