export type ReminderCandidate = {
  releaseAt: string;
  timezone: string;
  reminderHours: number;
};

export function reminderScheduledFor(candidate: ReminderCandidate) {
  const releaseAt = new Date(candidate.releaseAt);
  if (
    !Number.isFinite(releaseAt.getTime()) ||
    !Number.isInteger(candidate.reminderHours) ||
    candidate.reminderHours <= 0
  )
    return null;
  return new Date(releaseAt.getTime() - candidate.reminderHours * 60 * 60 * 1000);
}

export function isReminderDue(candidate: ReminderCandidate, now: Date, windowMinutes = 60) {
  const scheduledFor = reminderScheduledFor(candidate);
  if (!scheduledFor || !Number.isFinite(now.getTime()) || windowMinutes <= 0) return false;
  const elapsed = now.getTime() - scheduledFor.getTime();
  return elapsed >= 0 && elapsed < windowMinutes * 60 * 1000;
}

export function formatReminderDate(candidate: ReminderCandidate) {
  const releaseAt = new Date(candidate.releaseAt);
  if (!Number.isFinite(releaseAt.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: candidate.timezone || "UTC",
    }).format(releaseAt);
  } catch {
    return null;
  }
}

export type ReminderEmailInput = {
  releaseName: string;
  releaseDate: string;
  appUrl: string;
  supabaseUrl: string;
  unsubscribeToken: string;
};

/**
 * Builds the reminder email. Every message carries:
 *  - a link to notification settings,
 *  - a no-sign-in unsubscribe link to the web app's /unsubscribe confirmation page,
 *  - RFC 8058 one-click headers pointing at the `unsubscribe` Edge Function, which
 *    Gmail, Yahoo and Apple Mail use for their built-in Unsubscribe button.
 */
export function buildReminderEmail(input: ReminderEmailInput) {
  const appUrl = input.appUrl.replace(/\/$/, "");
  const token = encodeURIComponent(input.unsubscribeToken);
  const preferencesUrl = `${appUrl}/settings/notifications`;
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;
  const oneClickUrl = `${input.supabaseUrl.replace(/\/$/, "")}/functions/v1/unsubscribe?token=${token}`;
  return {
    subject: `${input.releaseName} releases soon`,
    text: [
      `${input.releaseName} releases ${input.releaseDate}.`,
      "",
      `Manage reminders: ${preferencesUrl}`,
      `Unsubscribe from all Sneaker Signal emails: ${unsubscribeUrl}`,
    ].join("\n"),
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
