import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { devLog } from '../../utils/logger.js';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveWebSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
  query?: {
    original: string;
  };
}

type BraveFreshnessKey = 'day' | 'week' | 'month' | 'year';
const BRAVE_API_FRESHNESS_MAP = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
  year: 'py',
};

async function searchBrave(
  query: string,
  count: number = 5,
  freshness?: BraveFreshnessKey
): Promise<BraveSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(count),
  });

  if (freshness) {
    params.set('freshness', BRAVE_API_FRESHNESS_MAP[freshness]);
  }

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': config.brave.apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as BraveWebSearchResponse;

  if (!data.web?.results) {
    return [];
  }

  return data.web.results.map((result) => ({
    title: result.title,
    url: result.url,
    description: result.description,
  }));
}

export function createSearchTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'web_search',
    description: `Search the web for current information. Use this when you need to find up-to-date information, news, facts, or anything you don't know or aren't sure about. Set freshness based on the user's intent (e.g., "today" → day, "this week" → week, "recent news" → week, "this year" → year).`,
    schema: z.object({
      query: z.string().describe('The search query to look up on the web'),
      numResults: z.number().optional().default(5).describe('Number of results to return (default: 5, max: 10)'),
      freshness: z.enum(['day', 'week', 'month', 'year']).optional().describe('Limit results to this recency window based on user intent'),
    }),
    func: async ({ query, numResults, freshness }) => {
      devLog('TOOL:web_search', 'Invoked', { query, numResults, freshness });
      try {
        const count = Math.min(numResults || 5, 10);
        const results = await searchBrave(query, count, freshness);
        devLog('TOOL:web_search', `Returned ${results.length} results`);

        if (results.length === 0) {
          return `No results found for "${query}".`;
        }

        const formatted = results.map((r, i) => 
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`
        ).join('\n\n');

        return `Search results for "${query}":\n\n${formatted}`;
      } catch (error) {
        console.error('Web search error:', error);
        return `Failed to search the web: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });
}
