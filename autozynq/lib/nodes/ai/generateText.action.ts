import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

// Config schema for AI Generate Text node
const configSchema = z.object({
  provider: z.enum(["openai", "gemini", "groq"]).default("groq"),
  model: z.string().default("llama-3.3-70b-versatile"),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1, "User prompt is required"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(8000).default(500),
  outputFormat: z
    .object({
      type: z.literal("json"),
      schema: z.record(z.string()).optional(),
    })
    .optional(),
});

// Input schema - accepts any previous node output
const inputSchema = z.object({
  input: z.any().optional(),
});

// Output schema - supports both text and JSON output formats
const outputSchema = z.object({
  text: z.string().optional(),
  json: z.record(z.any()).optional(),
  model: z.string(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

type Config = z.infer<typeof configSchema>;
type Output = z.infer<typeof outputSchema>;

/**
 * AI Generate Text Action Node
 * 
 * Calls AI API (OpenAI, Gemini, or Groq) to generate text or JSON based on a prompt.
 * Supports free-form text generation and structured JSON extraction.
 * Integrates with workflow execution engine and supports dynamic input.
 */
export const generateTextAction: AutomationNode = {
  type: "ai.action.generateText",
  category: "action",
  displayName: "AI Generate Text",
  description: "Generate text or extract JSON using an AI model (OpenAI, Gemini, or Groq)",
  configSchema,
  outputSchema,

  async run(ctx: NodeContext): Promise<Output> {
    // Validate config
    const config = configSchema.parse(ctx.config) as Config;

    // Interpolate userPrompt with previous output
    let fullPrompt = config.userPrompt;
    if (ctx.input) {
      const inputString =
        typeof ctx.input === "string"
          ? ctx.input
          : JSON.stringify(ctx.input, null, 2);
      fullPrompt = `${config.userPrompt}\n\nInput data:\n${inputString}`;
    }

    // If JSON output is requested, add instruction to response
    if (config.outputFormat?.type === "json") {
      fullPrompt += "\n\nRespond with ONLY valid JSON, no markdown or extra text.";
      if (config.outputFormat.schema) {
        fullPrompt += `\nExpected schema: ${JSON.stringify(config.outputFormat.schema)}`;
      }
    }

    // Route to appropriate provider
    if (config.provider === "gemini") {
      return await runGemini(config, fullPrompt, config.outputFormat?.type === "json");
    } else if (config.provider === "groq") {
      return await runGroq(config, fullPrompt, config.outputFormat?.type === "json");
    } else {
      return await runOpenAI(config, fullPrompt, config.outputFormat?.type === "json");
    }
  },
};

/**
 * Run with Google Gemini API
 */
async function runGemini(config: Config, fullPrompt: string, expectJson: boolean = false): Promise<Output> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY not found in environment. Get your key from: https://makersuite.google.com/app/apikey"
    );
  }

  // Merge system prompt with user prompt for Gemini
  const finalPrompt = config.systemPrompt
    ? `${config.systemPrompt}\n\n${fullPrompt}`
    : fullPrompt;

  console.log(`[AI Node] Calling Gemini API with model: ${config.model}`);
  console.log(`[AI Node] Prompt length: ${finalPrompt.length} chars`);

  // Call Gemini API
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: finalPrompt }],
            },
          ],
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
          },
        }),
      }
    );
  } catch (error) {
    throw new Error(
      `Failed to connect to Gemini API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // Parse response
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Failed to parse Gemini API response as JSON");
  }

  // Extract generated text
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    throw new Error(
      "Gemini API response missing generated text. Response: " +
        JSON.stringify(data)
    );
  }

  // Extract usage stats if available
  const usage = data?.usageMetadata
    ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      }
    : undefined;

  console.log(`[AI Node] Generated ${generatedText.length} chars`);
  console.log(`[AI Node] Usage:`, usage);

  // Parse JSON if requested
  let jsonOutput: Record<string, any> | undefined;
  if (expectJson) {
    try {
      jsonOutput = JSON.parse(generatedText);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${generatedText}`);
    }
  }

  // Return structured output
  const output: Output = expectJson
    ? {
        json: jsonOutput,
        model: config.model,
        usage,
      }
    : {
        text: generatedText.trim(),
        model: config.model,
        usage,
      };

  return outputSchema.parse(output);
}

/**
 * Run with Groq API
 */
async function runGroq(config: Config, fullPrompt: string, expectJson: boolean = false): Promise<Output> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY not found in environment. Get your key from: https://console.groq.com"
    );
  }

  // Prepare messages for Groq API (same format as OpenAI)
  const messages: Array<{ role: string; content: string }> = [];
  if (config.systemPrompt) {
    messages.push({ role: "system", content: config.systemPrompt });
  }
  messages.push({ role: "user", content: fullPrompt });

  console.log(`[AI Node] Calling Groq API with model: ${config.model}`);
  console.log(`[AI Node] Prompt length: ${fullPrompt.length} chars`);

  // Call Groq API
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to Groq API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // Parse response
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Failed to parse Groq API response as JSON");
  }

  // Extract generated text
  const generatedText = data?.choices?.[0]?.message?.content;
  if (!generatedText) {
    throw new Error(
      "Groq API response missing generated text. Response: " +
        JSON.stringify(data)
    );
  }

  // Extract usage stats
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      }
    : undefined;

  console.log(`[AI Node] Generated ${generatedText.length} chars`);
  console.log(`[AI Node] Usage:`, usage);

  // Parse JSON if requested
  let jsonOutput: Record<string, any> | undefined;
  if (expectJson) {
    try {
      jsonOutput = JSON.parse(generatedText);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${generatedText}`);
    }
  }

  // Return structured output
  const output: Output = expectJson
    ? {
        json: jsonOutput,
        model: config.model,
        usage,
      }
    : {
        text: generatedText.trim(),
        model: config.model,
        usage,
      };

  return outputSchema.parse(output);
}

/**
 * Run with OpenAI API
 */
async function runOpenAI(config: Config, fullPrompt: string, expectJson: boolean = false): Promise<Output> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found in environment. Please set it to use OpenAI."
    );
  }

  // Prepare messages for OpenAI Chat Completions
  const messages: Array<{ role: string; content: string }> = [];
  if (config.systemPrompt) {
    messages.push({ role: "system", content: config.systemPrompt });
  }
  messages.push({ role: "user", content: fullPrompt });

  console.log(`[AI Node] Calling OpenAI API with model: ${config.model}`);
  console.log(`[AI Node] Prompt length: ${fullPrompt.length} chars`);

  // Call OpenAI API
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to OpenAI API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // Parse response
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Failed to parse OpenAI API response as JSON");
  }

  // Extract generated text
  const generatedText = data?.choices?.[0]?.message?.content;
  if (!generatedText) {
    throw new Error(
      "OpenAI API response missing generated text. Response structure may have changed."
    );
  }

  // Extract usage stats if available
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      }
    : undefined;

  console.log(`[AI Node] Generated ${generatedText.length} chars`);
  console.log(`[AI Node] Usage:`, usage);

  // Parse JSON if requested
  let jsonOutput: Record<string, any> | undefined;
  if (expectJson) {
    try {
      jsonOutput = JSON.parse(generatedText);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${generatedText}`);
    }
  }

  // Return structured output
  const output: Output = expectJson
    ? {
        json: jsonOutput,
        model: config.model,
        usage,
      }
    : {
        text: generatedText.trim(),
        model: config.model,
        usage,
      };

  return outputSchema.parse(output);
}
