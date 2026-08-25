export const WON_STAGES = new Set([
  "closedwon",
  "1499916",
  "918641",
  "1090547557",
  "18284046",
  "13114424",
  "deal_registration_closed_won",
]);

export const LOST_STAGES = new Set([
  "closedlost",
  "1499917",
  "1405622351", // Salg: Unqualified lead
  "918642",
  "1090547558",
  "18298898",
  "1090547555",
  "11359580",
  "deal_registration_closed_lost",
]);

export const LEAD_STAGES = new Set([
  "1499913",
  "18284042",
  "deal_registration_discovery",
]);

export const MEETING_BOOKED_STAGES = new Set([
  "appointmentscheduled",
  "1499914",
  "918638",
  "1090547553",
  "18284044",
  "11374877",
  "13060019",
  "deal_registration_discovery",
]);

export const MEETING_HELD_STAGES = new Set([
  "presentationscheduled",
  "19052976",
  "918639",
  "1090547554",
  "13078631",
  "deal_registration_Solution Demo",
]);

export const TRIAL_STAGES = new Set([
  "1405622350", // Salg: Gratis prøveperiode (14 dager)
]);

export const OFFER_SENT_STAGES = new Set([
  "contractsent",
  "1499915",
  "918640",
  "9b4b0b98-bb9d-4bbc-9f3b-09fc6a6571fd",
  "1090547556",
  "18284045",
  "deal_registration_Pricing and Terms",
  "deal_registration_Out for Signature",
]);

export const BOOKED_OR_LATER_STAGES = new Set([
  ...MEETING_BOOKED_STAGES,
  ...MEETING_HELD_STAGES,
  ...TRIAL_STAGES,
  ...OFFER_SENT_STAGES,
  ...WON_STAGES,
]);

export const HELD_OR_LATER_STAGES = new Set([
  ...MEETING_HELD_STAGES,
  ...TRIAL_STAGES,
  ...OFFER_SENT_STAGES,
  ...WON_STAGES,
]);

export const OFFER_OR_LATER_STAGES = new Set([
  ...OFFER_SENT_STAGES,
  ...WON_STAGES,
]);

// Product naming has changed over time. Cover both "AI OS" and the newer
// "M51 AI" / "m51.ai" naming without the old catch-all match on the word "x".
export const AI_OS_PATTERN =
  /ai.?os|m51(?:\.|\s+)?ai\b|pil{1,2}ot|prøv(?:e)?\s+14|gratis\s+prøveperiode|\bpro\b|\bstarter\b|\benterprise\b|\bagency\b|\bdemo\b/i;
