// Mor Ben David — Hebrew message templates (milestone 5+).
//
// Templates are extracted verbatim from the spec at mor/docs/main-doc.md.
// IMPORTANT (per CLAUDE.md): Hebrew strings get corrupted when passed
// through Windows bash variables. Keep all Hebrew INSIDE this TS file —
// never echo / curl them through shell.
//
// Populated incrementally as milestones land:
//   milestone 5: trigger.* + followUpUnanswered + paymentConfirmation + morningReturn
//   milestone 7: modeUnavailable + modeNight
//   ongoing:    refine wording with Mor

export const MOR_TEMPLATES = {
  // Milestone 5
  newLeadGeneric: "",
  trigger: {
    relationshift: "",
    toxicSupport: "",
    karmaShift: "",
    decoding: "",
    oneOnOne: "",
  },
  followUpUnanswered: "",
  paymentConfirmation: "",
  morningReturn: "",

  // Milestone 7 (time-of-day modes)
  modeUnavailable: "",
  modeNight: "",
} as const;

export type MorTemplateKey = keyof typeof MOR_TEMPLATES;
