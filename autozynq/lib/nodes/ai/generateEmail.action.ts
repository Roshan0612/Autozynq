import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

// Config for AI Generate Email (kept simple and mock-friendly)
const configSchema = z.object({
  instructions: z
    .string()
    .optional()
    .describe("Optional guidance for crafting the email subject and body"),
});

const outputSchema = z.object({
  subject: z.string(),
  body: z.string(),
  // Pass-through of original trigger answers so downstream nodes can interpolate
  answers: z.record(z.any()).optional(),
});

type Config = z.infer<typeof configSchema>;

function get(obj: any, path: string, fallback: any = ""): any {
  try {
    return path
      .split(".")
      .reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

export const generateEmailAction: AutomationNode = {
  type: "ai.action.generateEmail",
  category: "action",
  displayName: "AI Generate Email",
  description: "Create a subject and body from prior step data (mock)",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Pull common fields from input (e.g., Google Forms normalized shape)
    const input: any = ctx.input || {};
    const answers = (input && input.answers) || {};
    const name = (answers && (answers["Name"] || answers["What is your name?"])) || get(input, "name", "there");

    const defaultSubject = `Thanks for your response${name ? ", " + name : ""}`;

    const instructionLine = cfg.instructions
      ? `Instructions: ${cfg.instructions}`
      : "Instructions: Write a short, friendly email acknowledging their submission.";

    const body = [
      `Hi ${name || "there"},`,
      "",
      "Thanks for filling out the form. We really appreciate your time!",
      "",
      instructionLine,
      "",
      "Best regards,",
      "Autozynq Demo",
    ].join("\n");

    const output = { subject: defaultSubject, body, answers };
    return outputSchema.parse(output);
  },
};
