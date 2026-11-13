import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

export const releaseStatuses = [
  "tentative",
  "confirmed",
  "postponed",
  "cancelled",
  "restock",
  "sold_out",
] as const;
export const launchTypes = ["online", "in_store", "raffle", "draw", "restock", "unknown"] as const;
export const sourceTypes = [
  { value: "brand", label: "Brand (tier 1)", tier: 1 },
  { value: "retailer", label: "Authorized retailer (tier 2)", tier: 2 },
  { value: "licensed_feed", label: "Licensed feed (tier 3)", tier: 3 },
  { value: "editorial", label: "Editorial report (tier 4)", tier: 4 },
  { value: "community", label: "Community tip (tier 5)", tier: 5 },
  { value: "ai_assist", label: "AI-assisted (tier 5)", tier: 5 },
] as const;
export const editorTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export type EditorialState =
  "imported" | "needs_review" | "approved" | "scheduled" | "published" | "rejected" | "archived";

export type EditorRelease = {
  id: string;
  release_at: string | null;
  release_timezone: string;
  retail_price: number | null;
  launch_type: string;
  status: string;
  editorial_status: EditorialState;
  last_verified_at: string | null;
  updated_at: string;
  products: {
    name: string;
    colorway: string | null;
    style_code: string | null;
    image_url: string | null;
    brands: { name: string; slug: string } | null;
  } | null;
  retailer_launches: { retailer_id: string; launch_url: string }[];
  release_sources: {
    verification_status: string;
    sources: { publisher: string; url: string; reliability_tier: number } | null;
  }[];
};

export type Option = { id: string; name: string; slug?: string };

export type ReleaseDraft = {
  release_id?: string;
  brand_slug: string;
  product_name: string;
  colorway: string;
  style_code: string;
  image_url: string;
  launch_local: string;
  release_timezone: string;
  retail_price: string;
  launch_type: string;
  status: string;
  source_type: string;
  source_publisher: string;
  source_url: string;
  retailer_id: string;
  retailer_url: string;
  reason: string;
};

export const emptyDraft: ReleaseDraft = {
  brand_slug: "",
  product_name: "",
  colorway: "",
  style_code: "",
  image_url: "",
  launch_local: "",
  release_timezone: "America/New_York",
  retail_price: "",
  launch_type: "online",
  status: "tentative",
  source_type: "brand",
  source_publisher: "",
  source_url: "",
  retailer_id: "",
  retailer_url: "",
  reason: "",
};

// The generated Database type only covers the tables the public app uses, so the
// editor talks to Supabase through an untyped client and types results itself.
const client = () => supabase as unknown as SupabaseClient | null;

function tzOffsetMs(utcMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-12-05T10:00" in `timeZone` → UTC ISO string. Returns null for empty or invalid input. */
export function localInputToIso(local: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const wallClock = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wallClock - tzOffsetMs(wallClock, timeZone);
  utc = wallClock - tzOffsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** UTC timestamp → "YYYY-MM-DDTHH:mm" wall-clock value in `timeZone`, for datetime-local inputs. */
export function isoToLocalInput(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const utc = new Date(iso).getTime();
  if (!Number.isFinite(utc)) return "";
  return new Date(utc + tzOffsetMs(utc, timeZone)).toISOString().slice(0, 16);
}

export function sourceTier(sourceType: string) {
  return sourceTypes.find((type) => type.value === sourceType)?.tier ?? 5;
}

export function draftFromRelease(release: EditorRelease): ReleaseDraft {
  const launch = release.retailer_launches[0];
  return {
    ...emptyDraft,
    release_id: release.id,
    brand_slug: release.products?.brands?.slug ?? "",
    product_name: release.products?.name ?? "",
    colorway: release.products?.colorway ?? "",
    style_code: release.products?.style_code ?? "",
    image_url: release.products?.image_url ?? "",
    launch_local: isoToLocalInput(release.release_at, release.release_timezone),
    release_timezone: release.release_timezone,
    retail_price: release.retail_price === null ? "" : String(release.retail_price),
    launch_type: release.launch_type,
    status: release.status === "expired" ? "confirmed" : release.status,
    // Sources are append-only; editors add a new one when re-verifying.
    source_publisher: "",
    source_url: "",
    retailer_id: launch?.retailer_id ?? "",
    retailer_url: launch?.launch_url ?? "",
  };
}

/** Shape the form into the editor_save_release payload. */
export function draftToPayload(draft: ReleaseDraft, editorialStatus: "needs_review" | "published") {
  return {
    release_id: draft.release_id ?? null,
    brand_slug: draft.brand_slug,
    product_name: draft.product_name.trim(),
    colorway: draft.colorway.trim(),
    style_code: draft.style_code.trim(),
    image_url: draft.image_url.trim(),
    release_at: localInputToIso(draft.launch_local, draft.release_timezone),
    release_timezone: draft.release_timezone,
    retail_price: draft.retail_price.trim(),
    launch_type: draft.launch_type,
    status: draft.status,
    source_type: draft.source_type,
    source_tier: sourceTier(draft.source_type),
    source_publisher: draft.source_publisher.trim(),
    source_url: draft.source_url.trim(),
    retailer_id: draft.retailer_id,
    retailer_url: draft.retailer_url.trim(),
    reason: draft.reason.trim(),
    editorial_status: editorialStatus,
  };
}

export async function checkIsEditor(): Promise<boolean> {
  const db = client();
  if (!db) return false;
  const { data, error } = await db.rpc("is_editor");
  return !error && data === true;
}

export async function loadEditorData(): Promise<{
  releases: EditorRelease[];
  brands: Option[];
  retailers: Option[];
  error: string | null;
}> {
  const db = client();
  if (!db) return { releases: [], brands: [], retailers: [], error: "Supabase is not configured." };
  const [releases, brands, retailers] = await Promise.all([
    db
      .from("releases")
      .select(
        "id, release_at, release_timezone, retail_price, launch_type, status, editorial_status, " +
          "last_verified_at, updated_at, products(name, colorway, style_code, image_url, brands(name, slug)), " +
          "retailer_launches(retailer_id, launch_url), release_sources(verification_status, " +
          "sources(publisher, url, reliability_tier))",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    db.from("brands").select("id, name, slug").eq("supported", true).order("name"),
    db.from("retailers").select("id, name").order("name"),
  ]);
  return {
    releases: (releases.data ?? []) as unknown as EditorRelease[],
    brands: (brands.data ?? []) as Option[],
    retailers: (retailers.data ?? []) as Option[],
    error: releases.error?.message ?? brands.error?.message ?? retailers.error?.message ?? null,
  };
}

export async function saveDraft(
  draft: ReleaseDraft,
  editorialStatus: "needs_review" | "published",
) {
  const db = client();
  if (!db) return { id: null, error: "Supabase is not configured." };
  const { data, error } = await db.rpc("editor_save_release", {
    p: draftToPayload(draft, editorialStatus),
  });
  return { id: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function setReleaseState(
  releaseId: string,
  change: { editorialStatus?: EditorialState; status?: string; reason?: string },
) {
  const db = client();
  if (!db) return { error: "Supabase is not configured." };
  const { error } = await db.rpc("editor_set_release_state", {
    p_release_id: releaseId,
    p_editorial_status: change.editorialStatus ?? null,
    p_status: change.status ?? null,
    p_reason: change.reason ?? null,
  });
  return { error: error?.message ?? null };
}
