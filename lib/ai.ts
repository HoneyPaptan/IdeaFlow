// AI client configuration using OpenRouter for chat and Groq for whisper.
// Env keys (you said you'll set them):
// - OPENROUTER_API_KEY
// - GROQ_API_KEY

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const OPENROUTER_DEFAULT_MODEL = "meta-llama/llama-4-maverick";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function createCompletion(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // Optional OpenRouter headers for routing/analytics:
      // "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "",
      // "X-Title": "IdeaFlow",
    },
    body: JSON.stringify({
      model: options.model ?? OPENROUTER_DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function streamCompletion(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): Promise<ReadableStream<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? OPENROUTER_DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      if (!reader) {
        controller.close();
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(content);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    },
  });
}

// Groq Whisper (speech-to-text) client
export type TranscriptionOptions = {
  language?: string;
};

export async function transcribeAudio(file: File, options: TranscriptionOptions = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-large-v3-turbo");
  if (options.language) formData.append("language", options.language);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.text as string;
}

