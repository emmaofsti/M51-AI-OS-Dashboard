// The dashboard reports the dedicated M51 AI pipeline only. HubSpot creates
// new internal IDs when a pipeline or stage is replaced, even when the visible
// labels stay similar. Keep these IDs aligned with the live M51 AI pipeline.
export const SALES_PIPELINE_ID = "930658310";

export const WON_STAGES = new Set(["1427866162"]);

export const LOST_STAGES = new Set(["1427866163"]);

// Unqualified leads never became sales opportunities and must not lower the
// closing rate or appear as lost deals. They are only terminal for trial-cohort
// analysis when a trial later gets disqualified.
export const DISQUALIFIED_STAGES = new Set(["1427866164"]);

export const LEAD_STAGES = new Set(["1427866157"]);

export const MEETING_BOOKED_STAGES = new Set(["1427866158"]);

export const MEETING_HELD_STAGES = new Set(["1427866159"]);

export const TRIAL_STAGES = new Set([
  "1427866160", // M51 AI: Gratis prøveperiode (14 dager)
]);

export const OFFER_SENT_STAGES = new Set(["1427866161"]);

export const AI_OS_SERVICE = "AI Agency OS";

// Product naming has changed over time. Cover both "AI OS" and the newer
// "M51 AI" / "m51.ai" naming without the old catch-all match on the word "x".
export const AI_OS_PATTERN =
  /ai.?os|m51(?:\.|\s+)?ai\b|pil{1,2}ot|prøv(?:e)?\s+14|gratis\s+prøveperiode|demo\s+etter\s+webinar/i;
