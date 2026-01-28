/**
 * Template Resolution Engine
 * 
 * Resolves template strings like "Hello {{steps.trigger1.name}}" by replacing
 * placeholders with actual values from previous node outputs.
 * 
 * Supports:
 * - Simple field access: {{steps.nodeId.field}}
 * - Nested field access: {{steps.nodeId.user.email}}
 * - Array access: {{steps.nodeId.items.0.name}}
 * - Fallback to empty string if field missing
 */

/**
 * Parse template string and extract all {{...}} references
 */
export function extractTemplateRefs(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const refs: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    refs.push(match[1].trim());
  }

  return refs;
}

/**
 * Resolve a single reference path like "steps.nodeId.field.nested"
 * Returns the value from previousOutputs or undefined if not found
 */
export function resolveReference(
  ref: string,
  previousOutputs: Record<string, unknown>
): unknown {
  // Expected format: "steps.nodeId.field.nested"
  const parts = ref.split(".");

  if (parts[0] !== "steps") {
    console.warn(
      `[TemplateResolver] Invalid reference format: ${ref} (must start with "steps.")`
    );
    return undefined;
  }

  if (parts.length < 3) {
    console.warn(
      `[TemplateResolver] Invalid reference format: ${ref} (must be "steps.nodeId.field")`
    );
    return undefined;
  }

  const nodeId = parts[1];
  const fieldPath = parts.slice(2); // ["field", "nested", "0"]

  const nodeOutput = previousOutputs[nodeId];
  if (!nodeOutput) {
    console.warn(
      `[TemplateResolver] Node output not found: ${nodeId}`
    );
    return undefined;
  }

  // Traverse nested path
  let value: unknown = nodeOutput;
  for (const key of fieldPath) {
    if (value === null || value === undefined) {
      return undefined;
    }

    // Handle array access
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else if (typeof value === "object") {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Resolve all {{...}} templates in a string
 * 
 * @param template - String with {{steps.nodeId.field}} placeholders
 * @param previousOutputs - Map of { nodeId: output }
 * @returns Resolved string with values substituted
 * 
 * @example
 * resolveTemplate(
 *   "Hello {{steps.trigger1.name}}!",
 *   { trigger1: { name: "John" } }
 * ) => "Hello John!"
 */
export function resolveTemplate(
  template: string,
  previousOutputs: Record<string, unknown>
): string {
  const refs = extractTemplateRefs(template);

  let resolved = template;
  for (const ref of refs) {
    const value = resolveReference(ref, previousOutputs);
    const stringValue =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

    // Replace all occurrences of this reference
    resolved = resolved.replace(new RegExp(`\\{\\{${ref}\\}\\}`, "g"), stringValue);
  }

  return resolved;
}

/**
 * Recursively resolve templates in an object
 * 
 * Processes all string values in a config object and replaces {{...}} references
 * 
 * @param config - Node config object (may contain template strings)
 * @param previousOutputs - Map of { nodeId: output }
 * @returns Config with all templates resolved
 */
export function resolveConfigTemplates(
  config: unknown,
  previousOutputs: Record<string, unknown>
): unknown {
  if (typeof config === "string") {
    return resolveTemplate(config, previousOutputs);
  }

  if (Array.isArray(config)) {
    return config.map((item) => resolveConfigTemplates(item, previousOutputs));
  }

  if (typeof config === "object" && config !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      resolved[key] = resolveConfigTemplates(value, previousOutputs);
    }
    return resolved;
  }

  return config;
}

/**
 * Validate that all references in a template can be resolved
 * 
 * @throws Error if any reference points to a missing node or field
 */
export function validateTemplateRefs(
  template: string,
  previousOutputs: Record<string, unknown>
): void {
  const refs = extractTemplateRefs(template);

  for (const ref of refs) {
    const value = resolveReference(ref, previousOutputs);
    if (value === undefined) {
      throw new Error(
        `Template reference "${ref}" could not be resolved. Available nodes: ${Object.keys(
          previousOutputs
        ).join(", ")}`
      );
    }
  }
}
