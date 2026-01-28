/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type HttpMethod = (typeof methods)[number];

function parseHeaders(input: Record<string, unknown> | undefined): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      headers[key] = value;
    } else if (value !== undefined) {
      headers[key] = String(value);
    }
  }
  return headers;
}

export const httpRequestNode: AutomationNode = {
  type: "action.http.request",
  category: "action",
  displayName: "HTTP Request",
  description: "Perform an HTTP request with optional headers and body",
  configSchema: z.object({
    url: z.string().url({ message: "url must be a valid URL" }),
    method: z.enum(methods).default("GET"),
    headers: z.record(z.any()).optional(),
    body: z.any().optional(),
  }),
  outputSchema: z.any(),
  outputFields: [],
  requiresConnection: false,
  async run(ctx: NodeContext) {
    const cfg = ctx.config as { url: string; method: HttpMethod; headers?: Record<string, unknown>; body?: any };
    const headers = parseHeaders(cfg.headers);
    const hasJsonBody = cfg.body !== undefined && cfg.body !== null;

    const response = await fetch(cfg.url, {
      method: cfg.method,
      headers: {
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: hasJsonBody && cfg.method !== "GET" ? JSON.stringify(cfg.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    let payload: unknown = null;
    try {
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }
    } catch {
      payload = await response.text().catch(() => null);
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: payload,
    };
  },
};
