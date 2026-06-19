const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { buildSearchQuery } = require('../src/services/searchQuery');
const { searchWeb } = require('../src/services/tavily');
const {
  structureSearchResults,
  parseStructuredResponse,
  normalizeResult,
} = require('../src/services/lmStudio');

const sampleItem = {
  title: 'Wireless headphones',
  desired_features: 'noise cancelling',
  price_range_min: 100,
  price_range_max: 250,
  image_url: null,
};

const mockStructuredResults = {
  results: [
    {
      site_name: 'Amazon',
      url: 'https://amazon.com/dp/123',
      price: '$129.99',
      original_price: '$149.99',
      discount: '13%',
      trustworthiness_score: 8,
      notes: 'Matches noise-cancelling requirement',
    },
  ],
};

function mockFetch(handlers) {
  return async (url, opts) => {
    for (const handler of handlers) {
      const result = await handler(url, opts);
      if (result) return result;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

function jsonResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
}

function loadApp() {
  delete require.cache[require.resolve('../src/db')];
  delete require.cache[require.resolve('../src/services/tavily')];
  delete require.cache[require.resolve('../src/services/lmStudio')];
  delete require.cache[require.resolve('../src/routes/items')];
  delete require.cache[require.resolve('../src/index')];
  return require('../src/index');
}

describe('buildSearchQuery', () => {
  it('includes title, features, and price range', () => {
    const query = buildSearchQuery(sampleItem);
    assert.match(query, /Wireless headphones/);
    assert.match(query, /noise cancelling/);
    assert.match(query, /\$100-\$250/);
    assert.match(query, /buy price/);
  });

  it('omits features when not set', () => {
    const query = buildSearchQuery({
      title: 'Desk lamp',
      desired_features: null,
      price_range_min: null,
      price_range_max: null,
    });
    assert.equal(query, 'Desk lamp buy');
  });

  it('handles min-only price range', () => {
    const query = buildSearchQuery({
      title: 'Monitor',
      desired_features: '4K',
      price_range_min: 300,
      price_range_max: null,
    });
    assert.match(query, /\$300\+/);
  });
});

describe('lmStudio helpers', () => {
  it('parseStructuredResponse normalizes results', () => {
    const parsed = parseStructuredResponse(JSON.stringify(mockStructuredResults));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].site_name, 'Amazon');
    assert.equal(parsed[0].trustworthiness_score, 8);
  });

  it('normalizeResult clamps trustworthiness_score to 1-10', () => {
    const result = normalizeResult({
      site_name: 'Test',
      url: 'https://example.com',
      trustworthiness_score: 99,
      notes: 'ok',
    });
    assert.equal(result.trustworthiness_score, 10);
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => parseStructuredResponse('not json'), {
      message: 'LM Studio returned unparseable JSON',
    });
  });
});

describe('searchWeb', () => {
  const originalKey = process.env.TAVILY_API_KEY;

  afterEach(() => {
    process.env.TAVILY_API_KEY = originalKey;
  });

  it('throws when TAVILY_API_KEY is missing', async () => {
    delete process.env.TAVILY_API_KEY;
    await assert.rejects(() => searchWeb('test query'), {
      message: 'TAVILY_API_KEY is not configured',
    });
  });

  it('returns simplified results from Tavily', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const fetchFn = mockFetch([
      (url) => {
        if (url === 'https://api.tavily.com/search') {
          return jsonResponse({
            results: [
              { title: 'Product', url: 'https://shop.com', content: 'Snippet' },
            ],
          });
        }
        return null;
      },
    ]);

    const results = await searchWeb('headphones buy', fetchFn);
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Product');
    assert.equal(results[0].url, 'https://shop.com');
  });
});

describe('structureSearchResults', () => {
  const originalModel = process.env.LM_STUDIO_MODEL;

  afterEach(() => {
    process.env.LM_STUDIO_MODEL = originalModel;
  });

  it('throws when LM_STUDIO_MODEL is missing', async () => {
    delete process.env.LM_STUDIO_MODEL;
    await assert.rejects(
      () => structureSearchResults(sampleItem, [], mockFetch([])),
      { message: 'LM_STUDIO_MODEL is not configured' }
    );
  });

  it('returns structured results from LM Studio', async () => {
    process.env.LM_STUDIO_MODEL = 'test-model';
    const fetchFn = mockFetch([
      (url) => {
        if (url.endsWith('/chat/completions')) {
          return jsonResponse({
            choices: [{ message: { content: JSON.stringify(mockStructuredResults) } }],
          });
        }
        return null;
      },
    ]);

    const results = await structureSearchResults(
      sampleItem,
      [{ title: 'Headphones', url: 'https://amazon.com', content: 'Great sound' }],
      fetchFn
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].site_name, 'Amazon');
  });

  it('throws when LM Studio is unreachable', async () => {
    process.env.LM_STUDIO_MODEL = 'test-model';
    const fetchFn = async () => {
      const err = new Error('connect refused');
      err.code = 'ECONNREFUSED';
      throw err;
    };

    await assert.rejects(
      () => structureSearchResults(sampleItem, [], fetchFn),
      { message: 'LM Studio server is not running' }
    );
  });
});

describe('POST /api/items/:id/search', () => {
  let app;
  let createdId;
  const originalFetch = global.fetch;
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  const originalModel = process.env.LM_STUDIO_MODEL;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    process.env.TAVILY_API_KEY = 'test-key';
    process.env.LM_STUDIO_MODEL = 'test-model';

    global.fetch = mockFetch([
      (url) => {
        if (url === 'https://api.tavily.com/search') {
          return jsonResponse({
            results: [
              {
                title: 'Sony WH-1000XM5',
                url: 'https://amazon.com/dp/123',
                content: 'Noise cancelling headphones $299',
              },
            ],
          });
        }
        if (url.endsWith('/chat/completions')) {
          return jsonResponse({
            choices: [
              { message: { content: JSON.stringify(mockStructuredResults) } },
            ],
          });
        }
        return null;
      },
    ]);

    app = loadApp();

    const res = await request(app).post('/api/items').send(sampleItem);
    createdId = res.body.id;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TAVILY_API_KEY = originalTavilyKey;
    process.env.LM_STUDIO_MODEL = originalModel;
  });

  it('returns 404 for unknown item', async () => {
    const res = await request(app).post('/api/items/9999/search');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Item not found');
  });

  it('returns structured results for a valid item', async () => {
    const res = await request(app).post(`/api/items/${createdId}/search`);
    assert.equal(res.status, 200);
    assert.equal(res.body.results.length, 1);
    assert.equal(res.body.results[0].site_name, 'Amazon');
    assert.equal(res.body.results[0].trustworthiness_score, 8);
  });

  it('returns 503 when LM Studio is unreachable', async () => {
    global.fetch = mockFetch([
      (url) => {
        if (url === 'https://api.tavily.com/search') {
          return jsonResponse({ results: [] });
        }
        if (url.endsWith('/chat/completions')) {
          const err = new Error('connect refused');
          err.code = 'ECONNREFUSED';
          throw err;
        }
        return null;
      },
    ]);

    const res = await request(app).post(`/api/items/${createdId}/search`);
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'LM Studio server is not running');
  });

  it('returns 500 when TAVILY_API_KEY is unset', async () => {
    delete process.env.TAVILY_API_KEY;
    app = loadApp();

    const createRes = await request(app).post('/api/items').send(sampleItem);
    const res = await request(app).post(`/api/items/${createRes.body.id}/search`);
    assert.equal(res.status, 500);
    assert.match(res.body.error, /TAVILY_API_KEY/);
  });
});
