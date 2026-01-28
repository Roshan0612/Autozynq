import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

/**
 * If Condition Logic Node
 * 
 * Evaluates a condition on the input data and returns:
 * - { outcome: "true" } if condition passes
 * - { outcome: "false" } if condition fails
 * 
 * Usage:
 * - Configure with a comparison operator and value
 * - Input must be a number, string, or boolean
 * - Output has outcome: "true" | "false"
 * 
 * Edge routing:
 * - Outgoing edges with condition: "true" follow when outcome is true
 * - Outgoing edges with condition: "false" follow when outcome is false
 * - Edges without condition always follow
 */
export const ifConditionNode: AutomationNode = {
  type: "logic.condition",
  category: "logic",
  displayName: "If Condition",
  description: "Evaluate a condition and branch execution",
  
  configSchema: z.object({
    operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains"]),
    value: z.any(),
  }),

  outputSchema: z.object({
    outcome: z.enum(["true", "false"]),
  }),
  outputFields: [],
  requiresConnection: false,

  async run(ctx: NodeContext): Promise<{ outcome: "true" | "false" }> {
    const { input, config } = ctx;
    
    if (!config || typeof config !== "object") {
      throw new Error("If Condition: Invalid config");
    }

    const cfg = config as { operator?: string; value?: unknown };
    const operator = cfg.operator;
    const value = cfg.value;

    if (!operator) {
      throw new Error("If Condition: operator is required");
    }

    let result = false;

    switch (operator) {
      case "equals":
        result = input === value;
        break;
      case "notEquals":
        result = input !== value;
        break;
      case "greaterThan":
        result = typeof input === "number" && input > (value as number);
        break;
      case "lessThan":
        result = typeof input === "number" && input < (value as number);
        break;
      case "contains":
        if (typeof input === "string" && typeof value === "string") {
          result = input.includes(value);
        } else if (Array.isArray(input)) {
          result = input.includes(value);
        }
        break;
      default:
        throw new Error(`If Condition: Unknown operator ${operator}`);
    }

    return {
      outcome: result ? "true" : "false",
    };
  },
};
