# Wishlist App

A Node.js/Express backend with a local SQLite database for managing wishlist items.

## Setup

```bash
npm install && npm start
```

The server starts at `http://localhost:3000` and creates the SQLite database at `data/wishlist.db` on first run. Open that URL in a browser to use the wishlist UI.

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
