const express = require('express');
const db = require('../db');
const { buildSearchQuery } = require('../services/searchQuery');
const { searchWeb } = require('../services/tavily');
const { structureSearchResults } = require('../services/lmStudio');

const router = express.Router();

function validateItemFields(body) {
  const { title, desired_features, price_range_min, price_range_max, image_url } =
    body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { error: 'title is required' };
  }

  const parsePrice = (value, field) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { error: `${field} must be a number` };
    }
    return value;
  };

  const min = parsePrice(price_range_min, 'price_range_min');
  if (min && typeof min === 'object') {
    return min;
  }

  const max = parsePrice(price_range_max, 'price_range_max');
  if (max && typeof max === 'object') {
    return max;
  }

  if (min !== null && max !== null && min > max) {
    return {
      error: 'price_range_min must be less than or equal to price_range_max',
    };
  }

  return {
    title: title.trim(),
    desired_features: desired_features ?? null,
    price_range_min: min,
    price_range_max: max,
    image_url: image_url ?? null,
  };
}

router.get('/', (req, res) => {
  const items = db
    .prepare('SELECT * FROM items ORDER BY created_at DESC')
    .all();
  res.json(items);
});

router.post('/:id/search', async (req, res) => {
  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  try {
    const query = buildSearchQuery(item);
    const rawResults = await searchWeb(query);
    const results = await structureSearchResults(item, rawResults);
    res.json({ results });
  } catch (err) {
    if (err.code === 'MISSING_CONFIG') {
      return res.status(500).json({ error: err.message });
    }
    if (err.code === 'LM_STUDIO_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    if (err.code === 'TAVILY_ERROR' || err.code === 'LM_STUDIO_ERROR') {
      return res.status(502).json({ error: err.message });
    }
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/:id', (req, res) => {
  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(item);
});

router.post('/', (req, res) => {
  const fields = validateItemFields(req.body);
  if (fields.error) {
    return res.status(400).json({ error: fields.error });
  }

  const result = db
    .prepare(
      `INSERT INTO items (title, desired_features, price_range_min, price_range_max, image_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      fields.title,
      fields.desired_features,
      fields.price_range_min,
      fields.price_range_max,
      fields.image_url
    );

  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const fields = validateItemFields(req.body);
  if (fields.error) {
    return res.status(400).json({ error: fields.error });
  }

  db.prepare(
    `UPDATE items
     SET title = ?, desired_features = ?, price_range_min = ?, price_range_max = ?,
         image_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fields.title,
    fields.desired_features,
    fields.price_range_min,
    fields.price_range_max,
    fields.image_url,
    req.params.id
  );

  const item = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(req.params.id);

  res.json(item);
});

router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM items WHERE id = ?')
    .run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.status(204).send();
});

module.exports = router;
