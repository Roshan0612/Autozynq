import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

const configSchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
  formId: z.string().min(1, "formId required"),
});

const outputSchema = z.object({
  formId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  items: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })),
});

export const googleFormsGetFormAction: AutomationNode = {
  type: "google_forms.action.getForm",
  category: "action",
  displayName: "Google Forms – Get Form",
  description: "Fetch form metadata and items.",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    // Mock: return a simple shape based on formId
    return {
      formId: cfg.formId,
      title: `Mock Form ${cfg.formId}`,
      description: "A sample Google Form",
      items: [
        { id: "q1", title: "What is your name?", type: "shortAnswer" },
        { id: "q2", title: "Email", type: "shortAnswer" },
        { id: "q3", title: "Rating", type: "scale" },
      ],
    };
  },
};
