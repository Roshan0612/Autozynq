import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

export const logDebugNode: AutomationNode = {
  type: "action.log.debug",
  category: "action",
  displayName: "Log / Debug",
  description: "Log the current payload for debugging purposes",
  configSchema: z.object({
    message: z.string().optional(),
    level: z.enum(["info", "warn", "error"]).default("info"),
  }),
  outputSchema: z.any(),
  outputFields: [],
  requiresConnection: false,
  async run(ctx: NodeContext) {
    const cfg = ctx.config as { message?: string; level?: "info" | "warn" | "error" };
    const payload = {
      message: cfg?.message,
      input: ctx.input,
      executionId: ctx.executionId,
      workflowId: ctx.workflowId,
      nodeId: ctx.stepIndex,
    };

    const level = cfg?.level || "info";
    if (level === "warn") {
      console.warn("[Log Node]", payload);
    } else if (level === "error") {
      console.error("[Log Node]", payload);
    } else {
      console.log("[Log Node]", payload);
    }

    return {
      ...payload,
      level,
      timestamp: new Date().toISOString(),
    };
  },
};
