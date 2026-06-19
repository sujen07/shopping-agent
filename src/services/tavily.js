const TAVILY_API_URL = 'https://api.tavily.com/search';

function getApiKey() {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !key.trim()) {
    const err = new Error('TAVILY_API_KEY is not configured');
    err.code = 'MISSING_CONFIG';
    throw err;
  }
  return key.trim();
}

async function searchWeb(query, fetchFn = fetch) {
  const apiKey = getApiKey();

  let res;
  try {
    res = await fetchFn(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 10,
      }),
    });
  } catch (err) {
    const error = new Error(`Tavily search failed: ${err.message}`);
    error.code = 'TAVILY_ERROR';
    error.cause = err;
    throw error;
  }

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`Tavily search failed (${res.status}): ${body}`);
    error.code = 'TAVILY_ERROR';
    throw error;
  }

  const data = await res.json();
  if (!Array.isArray(data.results)) {
    const error = new Error('Tavily returned an invalid response');
    error.code = 'TAVILY_ERROR';
    throw error;
  }

  return data.results.map((result) => ({
    title: result.title || '',
    url: result.url || '',
    content: result.content || '',
  }));
}

module.exports = { searchWeb, getApiKey };
