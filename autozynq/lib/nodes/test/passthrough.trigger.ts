import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

// Test trigger that just passes through input for testing
export const testPassthroughTrigger: AutomationNode = {
  type: "test.trigger.passthrough",
  category: "trigger",
  displayName: "Test Passthrough Trigger",
  description: "Testing trigger that passes through the input value directly",
  configSchema: z.object({}),
  outputSchema: z.any(),

  async run(ctx: NodeContext) {
    // Simply return the input value
    return ctx.input;
  },
};
