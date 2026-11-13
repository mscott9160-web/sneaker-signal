import { describe, expect, it } from "vitest";
import {
  buildReminderEmail,
  formatReminderDate,
  isReminderDue,
  reminderScheduledFor,
} from "./reminder";

describe("release reminder windows", () => {
  const candidate = {
    releaseAt: "2026-09-13T14:00:00Z",
    timezone: "America/Los_Angeles",
    reminderHours: 24,
  };

  it("subtracts the configured hours from the release instant", () => {
    expect(reminderScheduledFor(candidate)?.toISOString()).toBe("2026-09-12T14:00:00.000Z");
  });

  it("matches an hourly delivery window", () => {
    expect(isReminderDue(candidate, new Date("2026-09-12T14:30:00Z"))).toBe(true);
    expect(isReminderDue(candidate, new Date("2026-09-12T15:01:00Z"))).toBe(false);
  });

  it("formats the release in the preference timezone", () => {
    expect(formatReminderDate(candidate)).toContain("7:00 AM");
  });

  it("does not throw for an invalid timezone", () => {
    expect(formatReminderDate({ ...candidate, timezone: "Not/A_Timezone" })).toBeNull();
  });
});

describe("reminder email", () => {
  const email = buildReminderEmail({
    releaseName: "Air Max 1",
    releaseDate: "Saturday, December 5, 2026 at 10:00 AM",
    appUrl: "https://sneakersignal.example/",
    supabaseUrl: "https://abc.supabase.co",
    unsubscribeToken: "3f1c2b4a-9d8e-4c7b-a6f5-1e2d3c4b5a69",
  });

  it("includes settings and no-sign-in unsubscribe links in the body", () => {
    expect(email.text).toContain("https://sneakersignal.example/settings/notifications");
    expect(email.text).toContain(
      "https://sneakersignal.example/unsubscribe?token=3f1c2b4a-9d8e-4c7b-a6f5-1e2d3c4b5a69",
    );
  });

  it("sets RFC 8058 one-click headers pointing at the unsubscribe function", () => {
    expect(email.headers).toEqual({
      "List-Unsubscribe":
        "<https://abc.supabase.co/functions/v1/unsubscribe?token=3f1c2b4a-9d8e-4c7b-a6f5-1e2d3c4b5a69>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
