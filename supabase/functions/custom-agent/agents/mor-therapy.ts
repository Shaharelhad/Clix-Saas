// Mor Ben David — custom-agent stub (milestone 2).
//
// Current scope: confirms the dispatch chain works end-to-end:
// flow-webhook → custom-agent → mor-therapy → real WhatsApp reply.
//
// Future milestones add: source detection, lead upsert, time-of-day mode,
// payment detection, persona LLM agent + tools, n8n events.
// Per the plan at mor/docs/PLAN-mor-custom-agent.md sections 5.2 and 9.

import { sendTextMessage } from "../../_shared/wa-messaging.ts";
import type { AgentContext } from "../index.ts";

const STUB_REPLY = "היי, התקבלה הודעה";

export const morTherapyAgent = {
  async run(ctx: AgentContext): Promise<void> {
    const { body } = ctx;

    console.log("[mor-therapy] received payload:", {
      type: body.type,
      customerId: body.customerId,
      from: body.from,
      isGroup: body.isGroup,
      messagePreview: typeof body.message === "string"
        ? body.message.slice(0, 80)
        : null,
    });

    if (body.isGroup) {
      console.log("[mor-therapy] skipping: group message");
      return;
    }

    if (body.type === "outgoing") {
      console.log("[mor-therapy] skipping: outgoing message (Mor's own reply)");
      return;
    }

    if (!body.from) {
      console.warn("[mor-therapy] no `from` field on payload — cannot reply");
      return;
    }

    try {
      const result = await sendTextMessage(body.customerId, body.from, STUB_REPLY);
      console.log("[mor-therapy] sent stub reply:", result);
    } catch (err) {
      console.error("[mor-therapy] send failed:", err);
    }

    // TODO milestone 3: mor_upsert_lead + status='new'
    // TODO milestone 5: trigger detection + welcome templates
    // TODO milestone 6: persona + LLM agent + tools
    // TODO milestone 7: time-of-day mode (16:00 / 22:00 / morning)
    // TODO milestone 8: payment detection + mor_mark_paid
    // TODO milestone 9: n8n event emission
  },
};
