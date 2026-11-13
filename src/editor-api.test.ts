import { describe, expect, it, vi } from "vitest";
import {
  draftFromRelease,
  draftToPayload,
  emptyDraft,
  isoToLocalInput,
  localInputToIso,
  sourceTier,
  type EditorRelease,
} from "./editor-api";

vi.mock("./supabase-client", () => ({ supabase: null }));

describe("editor launch times", () => {
  it("converts a wall-clock time in the release timezone to UTC", () => {
    expect(localInputToIso("2026-12-05T10:00", "America/New_York")).toBe(
      "2026-12-05T15:00:00.000Z",
    );
    expect(localInputToIso("2026-07-05T10:00", "America/New_York")).toBe(
      "2026-07-05T14:00:00.000Z",
    );
    expect(localInputToIso("2026-12-05T07:00", "America/Los_Angeles")).toBe(
      "2026-12-05T15:00:00.000Z",
    );
    expect(localInputToIso("2026-07-05T10:00", "America/Phoenix")).toBe("2026-07-05T17:00:00.000Z");
  });

  it("handles the days daylight saving time changes", () => {
    expect(localInputToIso("2026-03-08T10:00", "America/New_York")).toBe(
      "2026-03-08T14:00:00.000Z",
    );
    expect(localInputToIso("2026-11-01T10:00", "America/New_York")).toBe(
      "2026-11-01T15:00:00.000Z",
    );
  });

  it("round-trips UTC back to the form value", () => {
    for (const zone of ["America/New_York", "America/Chicago", "Pacific/Honolulu"]) {
      const iso = localInputToIso("2026-12-05T10:30", zone);
      expect(isoToLocalInput(iso, zone)).toBe("2026-12-05T10:30");
    }
  });

  it("treats empty or malformed input as no launch time", () => {
    expect(localInputToIso("", "America/New_York")).toBeNull();
    expect(localInputToIso("Dec 5", "America/New_York")).toBeNull();
    expect(isoToLocalInput(null, "America/New_York")).toBe("");
  });
});

describe("editor payload", () => {
  it("derives the source tier from the source type", () => {
    expect(sourceTier("brand")).toBe(1);
    expect(sourceTier("retailer")).toBe(2);
    expect(sourceTier("editorial")).toBe(4);
    expect(sourceTier("ai_assist")).toBe(5);
    expect(sourceTier("unknown")).toBe(5);
  });

  it("builds the save payload with a UTC launch time and trimmed text", () => {
    const payload = draftToPayload(
      {
        ...emptyDraft,
        brand_slug: "nike",
        product_name: "  Air Max 1  ",
        launch_local: "2026-12-05T10:00",
        source_type: "retailer",
        source_url: " https://shop.example/p ",
      },
      "published",
    );
    expect(payload).toMatchObject({
      release_id: null,
      product_name: "Air Max 1",
      release_at: "2026-12-05T15:00:00.000Z",
      source_tier: 2,
      source_url: "https://shop.example/p",
      editorial_status: "published",
    });
  });

  it("prefills the form from a release without reusing its sources", () => {
    const release: EditorRelease = {
      id: "r1",
      release_at: "2026-12-05T15:00:00Z",
      release_timezone: "America/New_York",
      retail_price: 150,
      launch_type: "online",
      status: "confirmed",
      editorial_status: "published",
      last_verified_at: null,
      updated_at: "2026-11-13T00:00:00Z",
      products: {
        name: "Air Max 1",
        colorway: "Red",
        style_code: null,
        image_url: null,
        brands: { name: "Nike", slug: "nike" },
      },
      retailer_launches: [{ retailer_id: "ret1", launch_url: "https://shop.example/p" }],
      release_sources: [],
    };
    expect(draftFromRelease(release)).toMatchObject({
      release_id: "r1",
      brand_slug: "nike",
      launch_local: "2026-12-05T10:00",
      retail_price: "150",
      retailer_id: "ret1",
      source_url: "",
    });
  });
});
