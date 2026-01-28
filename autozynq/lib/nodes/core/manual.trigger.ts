/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

export const manualTriggerNode: AutomationNode = {
  type: "trigger.manual",
  category: "trigger",
  displayName: "Manual Trigger",
  description: "Start a workflow manually with optional static payload",
  configSchema: z.object({
    payload: z.any().optional(),
  }),
  outputSchema: z.any(),
  outputFields: [],
  requiresConnection: false,
  async run(ctx: NodeContext) {
    // Manual trigger returns configured payload or passes through provided input
    if (ctx.config && typeof ctx.config === "object" && "payload" in (ctx.config as any)) {
      return (ctx.config as { payload?: unknown }).payload;
    }
    return ctx.input;
  },
};
