import { supabase } from "./supabase-client";

export type Release = {
  id: string;
  releaseDate: string | null;
  day: string;
  month: string;
  brand: string;
  name: string;
  color: string;
  price: string;
  currency: string;
  image: string | null;
  status: string;
  accent: string;
  retailers: RetailerLaunch[];
  provenance: "live" | "demo";
  releaseTimezone: string;
  launchType: string;
  lastVerifiedAt: string | null;
  publishedAt: string | null;
  sources: ReleaseSource[];
};

export type RetailerLaunch = {
  name: string;
  url: string;
  launchAt: string | null;
  launchType: string;
  availabilityStatus: string;
  lastCheckedAt: string | null;
};

export type ReleaseSource = {
  sourceType: string;
  publisher: string;
  url: string;
  reliabilityTier: number;
  capturedAt: string | null;
  fieldCoverage: string[];
  verificationStatus: string;
};

type DemoSeed = Pick<Release, "id" | "brand" | "name" | "color" | "price" | "image" | "accent"> & {
  daysFromToday: number;
};

const demoSeeds: DemoSeed[] = [
  {
    id: "demo-1",
    daysFromToday: 2,
    brand: "NIKE",
    name: "Air Max 95 OG",
    color: "Neon / Black",
    price: "$185",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
    accent: "#e1ff00",
  },
  {
    id: "demo-2",
    daysFromToday: 5,
    brand: "ADIDAS",
    name: "Samba OG Wales Bonner",
    color: "Cream White",
    price: "$160",
    image:
      "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85",
    accent: "#ff6446",
  },
  {
    id: "demo-3",
    daysFromToday: 11,
    brand: "NEW BALANCE",
    name: "990v6 Made in USA",
    color: "Vintage Grey",
    price: "$200",
    image:
      "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85",
    accent: "#a8c7ff",
  },
  {
    id: "demo-4",
    daysFromToday: 18,
    brand: "SAUCONY",
    name: "ProGrid Omni 9",
    color: "Silver / Green",
    price: "$150",
    image:
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85",
    accent: "#d4ffbd",
  },
];

const demoTimezone = "America/New_York";

/**
 * Sample catalog shown only when Supabase is not configured or unreachable.
 * Dates are generated relative to `now` so the demo never shows stale "upcoming"
 * releases, and each launch is a full timestamp (15:00 UTC, morning US Eastern)
 * so the date tile and the formatted launch time always agree.
 */
export function buildDemoReleases(now = new Date()): Release[] {
  return demoSeeds.map(({ daysFromToday, ...seed }) => {
    const launch = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromToday, 15),
    );
    const releaseDate = launch.toISOString();
    return {
      ...seed,
      releaseDate,
      ...formatReleaseDateParts(releaseDate, demoTimezone),
      currency: "USD",
      status: "",
      retailers: [],
      provenance: "demo",
      releaseTimezone: demoTimezone,
      launchType: "online",
      lastVerifiedAt: null,
      publishedAt: null,
      sources: [],
    };
  });
}

export const demoReleases: Release[] = buildDemoReleases();

export type DatabaseRelease = {
  id: string;
  release_at: string | null;
  retail_price: number | null;
  currency: string;
  status: string;
  release_timezone: string;
  launch_type: string;
  last_verified_at: string | null;
  published_at: string | null;
  products: DatabaseProduct | DatabaseProduct[] | null;
  retailer_launches: DatabaseRetailerLaunch[] | null;
  release_sources: DatabaseReleaseSource[] | null;
};

type DatabaseProduct = {
  name: string;
  colorway: string | null;
  image_url: string | null;
  brands: { name: string } | { name: string }[] | null;
};
type DatabaseRetailerLaunch = {
  launch_url: string;
  launch_at: string | null;
  launch_type: string;
  availability_status: string;
  last_checked_at: string | null;
  retailers: { name: string } | { name: string }[] | null;
};
type DatabaseReleaseSource = {
  field_coverage: string[];
  verification_status: string;
  sources:
    | {
        source_type: string;
        publisher: string;
        url: string;
        reliability_tier: number;
        captured_at: string | null;
      }
    | {
        source_type: string;
        publisher: string;
        url: string;
        reliability_tier: number;
        captured_at: string | null;
      }[]
    | null;
};

export function toRelease(row: DatabaseRelease): Release {
  const dateParts = formatReleaseDateParts(row.release_at, row.release_timezone);
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  const brand = product?.brands;
  const brandName = brand && Array.isArray(brand) ? brand[0]?.name : brand?.name;
  return {
    id: row.id,
    releaseDate: row.release_at,
    day: dateParts.day,
    month: dateParts.month,
    brand: brandName?.toUpperCase() ?? "UNKNOWN",
    name: product?.name ?? "Unnamed release",
    color: product?.colorway ?? "Colorway TBC",
    price:
      row.retail_price === null
        ? "TBC"
        : new Intl.NumberFormat("en-US", { style: "currency", currency: row.currency }).format(
            row.retail_price,
          ),
    currency: row.currency,
    image: product?.image_url ?? null,
    status: row.status.replace("_", " "),
    accent: "#ebe7df",
    provenance: "live",
    releaseTimezone: row.release_timezone,
    launchType: row.launch_type,
    lastVerifiedAt: row.last_verified_at,
    publishedAt: row.published_at,
    retailers: (row.retailer_launches ?? []).map((launch) => ({
      name: Array.isArray(launch.retailers)
        ? (launch.retailers[0]?.name ?? "Official retailer")
        : (launch.retailers?.name ?? "Official retailer"),
      url: launch.launch_url,
      launchAt: launch.launch_at,
      launchType: launch.launch_type,
      availabilityStatus: launch.availability_status,
      lastCheckedAt: launch.last_checked_at,
    })),
    sources: (row.release_sources ?? []).flatMap((link) => {
      const source = Array.isArray(link.sources) ? link.sources[0] : link.sources;
      return source
        ? [
            {
              sourceType: source.source_type,
              publisher: source.publisher,
              url: source.url,
              reliabilityTier: source.reliability_tier,
              capturedAt: source.captured_at,
              fieldCoverage: link.field_coverage,
              verificationStatus: link.verification_status,
            },
          ]
        : [];
    }),
  };
}

export type ReleaseLoadResult = {
  releases: Release[];
  error: string | null;
  provenance: "live" | "demo";
};

export function isSafeRetailerUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Releases stay listed for a day after launch so same-day drops remain visible. */
export function upcomingCutoff(now = new Date()) {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

export async function loadReleases(): Promise<ReleaseLoadResult> {
  if (!supabase)
    return {
      releases: demoReleases,
      error: "Live releases are not configured. Showing the demo catalog.",
      provenance: "demo",
    };

  const { data, error } = await supabase
    .from("releases")
    .select(
      "id, release_at, release_timezone, retail_price, currency, launch_type, status, last_verified_at, " +
        "published_at, products(name, colorway, image_url, brands(name)), retailer_launches(launch_url, " +
        "launch_at, launch_type, availability_status, last_checked_at, retailers(name)), release_sources(" +
        "field_coverage, verification_status, sources(source_type, publisher, url, reliability_tier, captured_at))",
    )
    .eq("editorial_status", "published")
    .eq("region", "US")
    .neq("status", "expired")
    .or(`release_at.is.null,release_at.gte.${upcomingCutoff().toISOString()}`)
    .order("release_at", { ascending: true, nullsFirst: false });

  if (error)
    return {
      releases: demoReleases,
      error: "Live releases are unavailable. Showing the demo catalog.",
      provenance: "demo",
    };
  return { releases: (data as DatabaseRelease[]).map(toRelease), error: null, provenance: "live" };
}

export function formatReleaseDateParts(releaseAt: string | null, timeZone: string) {
  if (!releaseAt) return { day: "--", month: "TBD" };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    day: "2-digit",
    month: "short",
  }).formatToParts(new Date(releaseAt));
  return {
    day: parts.find((part) => part.type === "day")?.value ?? "--",
    month: parts.find((part) => part.type === "month")?.value.toUpperCase() ?? "TBD",
  };
}

export function formatLaunchTime(launchAt: string | null, timeZone: string) {
  if (!launchAt) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(launchAt));
}

/** Whole calendar days from today until `timestamp`, both measured in `timeZone`. */
export function calendarDaysUntil(timestamp: string, timeZone: string, now = new Date()) {
  const dayNumber = (date: Date) => {
    const [month, day, year] = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(date)
      .split("/")
      .map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return dayNumber(new Date(timestamp)) - dayNumber(now);
}
