const { formatPriceRange } = require('./searchQuery');

const SYSTEM_PROMPT = `You are a shopping assistant. Given a wishlist item and web search results, identify where the item (or close matches) can be purchased.

Return ONLY valid JSON with this exact shape:
{
  "results": [
    {
      "site_name": "string",
      "url": "string",
      "price": "string or null",
      "original_price": "string or null",
      "discount": "string or null",
      "trustworthiness_score": number (1-10),
      "notes": "string"
    }
  ]
}

Rules:
- Include only retailers that likely sell the item or a close match
- trustworthiness_score: 10 = major trusted retailer, 1 = suspicious
- Use null for price fields when unknown
- Return an empty results array if nothing relevant is found
- Do not include markdown or explanation outside the JSON`;

function getConfig() {
  const baseUrl = (process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1').replace(
    /\/$/,
    ''
  );
  const model = process.env.LM_STUDIO_MODEL;
  const apiKey = process.env.LM_STUDIO_API_KEY || 'lm-studio';

  if (!model || !model.trim()) {
    const err = new Error('LM_STUDIO_MODEL is not configured');
    err.code = 'MISSING_CONFIG';
    throw err;
  }

  return { baseUrl, model: model.trim(), apiKey };
}

function buildUserPrompt(item, searchResults) {
  const priceRange = formatPriceRange(item.price_range_min, item.price_range_max);
  const features = item.desired_features || 'none specified';

  const resultsText = searchResults
    .map(
      (r, i) =>
        `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.content}`
    )
    .join('\n\n');

  return `Wishlist item:
- Title: ${item.title}
- Desired features: ${features}
- Price range: ${priceRange || 'not set'}

Web search results:
${resultsText || 'No results found.'}

Organize these into purchase options for the wishlist item.`;
}

function normalizeResult(raw) {
  const score = Number(raw.trustworthiness_score);
  return {
    site_name: String(raw.site_name || ''),
    url: String(raw.url || ''),
    price: raw.price != null ? String(raw.price) : null,
    original_price: raw.original_price != null ? String(raw.original_price) : null,
    discount: raw.discount != null ? String(raw.discount) : null,
    trustworthiness_score: Number.isFinite(score)
      ? Math.min(10, Math.max(1, Math.round(score)))
      : 5,
    notes: String(raw.notes || ''),
  };
}

function parseStructuredResponse(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const error = new Error('LM Studio returned unparseable JSON');
    error.code = 'LM_STUDIO_ERROR';
    throw error;
  }

  if (!parsed || !Array.isArray(parsed.results)) {
    const error = new Error('LM Studio returned an invalid response shape');
    error.code = 'LM_STUDIO_ERROR';
    throw error;
  }

  return parsed.results.map(normalizeResult);
}

async function structureSearchResults(item, searchResults, fetchFn = fetch) {
  const { baseUrl, model, apiKey } = getConfig();
  const url = `${baseUrl}/chat/completions`;

  let res;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(item, searchResults) },
        ],
      }),
    });
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED') {
      const error = new Error('LM Studio server is not running');
      error.code = 'LM_STUDIO_UNAVAILABLE';
      throw error;
    }
    const error = new Error(`LM Studio request failed: ${err.message}`);
    error.code = 'LM_STUDIO_ERROR';
    error.cause = err;
    throw error;
  }

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`LM Studio request failed (${res.status}): ${body}`);
    error.code = 'LM_STUDIO_ERROR';
    throw error;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('LM Studio returned an empty response');
    error.code = 'LM_STUDIO_ERROR';
    throw error;
  }

  return parseStructuredResponse(content);
}

module.exports = {
  structureSearchResults,
  getConfig,
  buildUserPrompt,
  parseStructuredResponse,
  normalizeResult,
};
