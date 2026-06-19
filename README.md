# Wishlist App

A Node.js/Express backend with a local SQLite database for managing wishlist items.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your TAVILY_API_KEY and LM_STUDIO_MODEL
npm start
```

The server starts at `http://localhost:3000` and creates the SQLite database at `data/wishlist.db` on first run. Open that URL in a browser to use the wishlist UI.

### Web search (optional)

The **Search Web** button on each wishlist card uses:

- **[Tavily](https://tavily.com)** for real-time web search (`TAVILY_API_KEY`)
- **[LM Studio](https://lmstudio.ai)** as a local OpenAI-compatible LLM to structure results

Before using search:

1. Start LM Studio's local server (Developer tab → Start server, or `lms server start`)
2. Set `LM_STUDIO_MODEL` in `.env` to the model identifier shown in LM Studio
3. Get a free Tavily API key and set `TAVILY_API_KEY` in `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_BASE_URL` | `http://localhost:1234/v1` | LM Studio OpenAI endpoint |
| `LM_STUDIO_MODEL` | *(required)* | Model id loaded in LM Studio |
| `LM_STUDIO_API_KEY` | `lm-studio` | Auth header (any non-empty string works locally) |
| `TAVILY_API_KEY` | *(required)* | Tavily search API key |

## API

### Health check

```bash
curl http://localhost:3000/health
```

### List items

```bash
curl http://localhost:3000/api/items
```

### Create an item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Wireless headphones",
    "desired_features": "noise cancelling, long battery life",
    "price_range_min": 100,
    "price_range_max": 250,
    "image_url": "https://example.com/headphones.jpg"
  }'
```

### Get an item

```bash
curl http://localhost:3000/api/items/1
```

### Update an item

```bash
curl -X PUT http://localhost:3000/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Premium wireless headphones",
    "desired_features": "noise cancelling, USB-C charging",
    "price_range_min": 150,
    "price_range_max": 300,
    "image_url": "https://example.com/headphones.jpg"
  }'
```

### Delete an item

```bash
curl -X DELETE http://localhost:3000/api/items/1
```

### Search the web for an item

Finds retailers selling the item (or close matches) using Tavily + LM Studio:

```bash
curl -X POST http://localhost:3000/api/items/1/search
```

Response:

```json
{
  "results": [
    {
      "site_name": "Amazon",
      "url": "https://...",
      "price": "$129.99",
      "original_price": "$149.99",
      "discount": "13%",
      "trustworthiness_score": 8,
      "notes": "Matches noise-cancelling requirement"
    }
  ]
}
```
