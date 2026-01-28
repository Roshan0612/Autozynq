/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

// Config schema for Instagram Create Post action
const configSchema = z.object({
  imageUrl: z.string().min(1, "Image URL required"),
  caption: z.string().min(1, "Caption required"),
  publishImmediately: z.boolean().default(true),
});

// Output schema
const outputSchema = z.object({
  postId: z.string(),
  url: z.string(),
});

type Config = z.infer<typeof configSchema>;

function interpolate(template: string, ctxInput: any): string {
  if (typeof template !== "string") return "";
  return template.replace(/\{{2}\s*([^}]+?)\s*\}{2}/g, (_match, p1) => {
    const path = String(p1).trim();
    const val = getNestedValue(ctxInput, path);
    return val != null ? String(val) : "";
  });
}

function getNestedValue(obj: any, path: string, fallback: any = ""): any {
  try {
    return path
      .split(".")
      .reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

export const instagramCreatePostAction: AutomationNode = {
  type: "instagram.action.createPost",
  category: "action",
  displayName: "Instagram Create Post",
  description: "Create a post on Instagram with image and caption",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: false,

  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Resolve templated fields against prior output
    const prior = ctx.input || {};
    const imageUrl = interpolate(cfg.imageUrl, prior);
    const caption = interpolate(cfg.caption, prior);

    // Mock implementation: simulate successful Instagram post creation
    // In production, would integrate with Instagram Graph API
    const postId = `ig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = `https://instagram.com/p/${postId}`;
    console.log(`[Instagram] Created post: ${url}, Caption: ${caption}`);

    return outputSchema.parse({
      postId,
      url,
    });
  },
};
