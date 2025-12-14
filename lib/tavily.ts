// Tavily API client for web research
const TAVILY_URL = "https://api.tavily.com/search";

export type TavilySearchOptions = {
  query: string;
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
};

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  rawContent?: string;
};

export type TavilyResponse = {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  responseTime: number;
};

export async function searchTavily(
  options: TavilySearchOptions,
  apiKey?: string
): Promise<TavilyResponse> {
  const key = apiKey || process.env.TAVILY_API_KEY;

  if (!key) {
    throw new Error("Tavily API key is required. Please add it in Settings or set TAVILY_API_KEY environment variable.");
  }

  const response = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: key,
      query: options.query,
      search_depth: options.searchDepth || "basic",
      max_results: options.maxResults || 5,
      include_answer: options.includeAnswer ?? true,
      include_raw_content: options.includeRawContent ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data as TavilyResponse;
}

