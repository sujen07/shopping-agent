const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const items = db
    .prepare('SELECT * FROM items ORDER BY created_at DESC')
    .all();
  res.json(items);
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
  const { title, desired_features, price_range_min, price_range_max, image_url } =
    req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const result = db
    .prepare(
      `INSERT INTO items (title, desired_features, price_range_min, price_range_max, image_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      desired_features ?? null,
      price_range_min ?? null,
      price_range_max ?? null,
      image_url ?? null
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

  const { title, desired_features, price_range_min, price_range_max, image_url } =
    req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  db.prepare(
    `UPDATE items
     SET title = ?, desired_features = ?, price_range_min = ?, price_range_max = ?,
         image_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title.trim(),
    desired_features ?? null,
    price_range_min ?? null,
    price_range_max ?? null,
    image_url ?? null,
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
