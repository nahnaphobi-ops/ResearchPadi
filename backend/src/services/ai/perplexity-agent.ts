import axios from 'axios';

/**
 * Perplexity Agent API (replaced Sonar Chat Completions, retired 27 Sep 2026).
 * POST /v1/agent with a `preset` and an `input`; the answer and its sources come
 * back as items in `output` (a `message` item and a `search_results` item).
 * https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview
 */
const AGENT_URL = 'https://api.perplexity.ai/v1/agent';

export interface AgentSource {
  title?: string;
  url: string;
  snippet?: string;
  date?: string;
}

export interface AgentResult {
  text: string;
  sources: AgentSource[];
  inputTokens: number;
  outputTokens: number;
}

/** Pull the answer text and sources out of an Agent API response body. */
export function parseAgentResponse(body: any): AgentResult {
  const output: any[] = Array.isArray(body?.output) ? body.output : [];

  let text = typeof body?.output_text === 'string' ? body.output_text : '';
  if (!text) {
    text = output
      .filter((item) => item?.type === 'message')
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .filter((part: any) => part?.type === 'output_text' && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('\n')
      .trim();
  }

  const sources: AgentSource[] = output
    .filter((item) => item?.type === 'search_results' && Array.isArray(item.results))
    .flatMap((item) => item.results)
    .filter((r: any) => typeof r?.url === 'string')
    .map((r: any) => ({ title: r.title, url: r.url, snippet: r.snippet, date: r.date }));

  const usage = body?.usage ?? {};
  return {
    text,
    sources,
    inputTokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0,
    outputTokens: Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0,
  };
}

export async function callPerplexityAgent(preset: string, input: string, timeoutMs = 45_000): Promise<AgentResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error('PERPLEXITY_API_KEY not configured');

  const response = await axios.post(
    AGENT_URL,
    { preset, input },
    {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: timeoutMs,
    },
  );

  const result = parseAgentResponse(response.data);
  if (!result.text) throw new Error('Perplexity Agent API returned no text');
  return result;
}
