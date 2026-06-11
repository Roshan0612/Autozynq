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
  app: "Google Forms",
  displayName: "Google Forms – Get Form",
  description: "Fetch form metadata and items.",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: true,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    // TODO: Implement real Google Forms API call here for production
    throw new Error("Google Forms getForm action is not implemented in production mode.");
  },
};
