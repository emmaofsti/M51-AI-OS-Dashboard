// The dashboard reports the M51 sales pipeline only. Mixing identically named
// stages from Customer Success and partner pipelines was a major source of
// inflated counts.
export const SALES_PIPELINE_ID = "469391";

export const WON_STAGES = new Set(["1499916"]);

export const LOST_STAGES = new Set(["1499917"]);

// Unqualified leads never became sales opportunities and must not lower the
// closing rate or appear as lost deals. They are only terminal for trial-cohort
// analysis when a trial later gets disqualified.
export const DISQUALIFIED_STAGES = new Set(["1405622351"]);

export const LEAD_STAGES = new Set(["1499913"]);

export const MEETING_BOOKED_STAGES = new Set(["1499914"]);

export const MEETING_HELD_STAGES = new Set(["19052976"]);

export const TRIAL_STAGES = new Set([
  "1405622350", // Salg: Gratis prøveperiode (14 dager)
]);

export const OFFER_SENT_STAGES = new Set(["1499915"]);

export const AI_OS_SERVICE = "AI Agency OS";

// Product naming has changed over time. Cover both "AI OS" and the newer
// "M51 AI" / "m51.ai" naming without the old catch-all match on the word "x".
export const AI_OS_PATTERN =
  /ai.?os|m51(?:\.|\s+)?ai\b|pil{1,2}ot|prøv(?:e)?\s+14|gratis\s+prøveperiode|demo\s+etter\s+webinar/i;
