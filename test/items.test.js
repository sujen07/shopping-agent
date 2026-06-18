const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.DB_PATH = ':memory:';

const app = require('../src/index');

const sampleItem = {
  title: 'Wireless headphones',
  desired_features: 'noise cancelling',
  price_range_min: 100,
  price_range_max: 250,
  image_url: 'https://example.com/headphones.jpg',
};

describe('items API', () => {
  let createdId;

  it('GET /api/items returns an empty list initially', async () => {
    const res = await request(app).get('/api/items');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('POST /api/items creates an item', async () => {
    const res = await request(app).post('/api/items').send(sampleItem);
    assert.equal(res.status, 201);
    assert.equal(res.body.title, sampleItem.title);
    assert.equal(res.body.desired_features, sampleItem.desired_features);
    assert.equal(res.body.price_range_min, sampleItem.price_range_min);
    assert.equal(res.body.price_range_max, sampleItem.price_range_max);
    assert.equal(res.body.image_url, sampleItem.image_url);
    createdId = res.body.id;
  });

  it('GET /api/items lists created items', async () => {
    const res = await request(app).get('/api/items');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, createdId);
  });

  it('PUT /api/items/:id updates an item', async () => {
    const res = await request(app)
      .put(`/api/items/${createdId}`)
      .send({ ...sampleItem, title: 'Premium headphones' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Premium headphones');
  });

  it('DELETE /api/items/:id removes an item', async () => {
    const res = await request(app).delete(`/api/items/${createdId}`);
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
  });

  it('returns 404 for unknown item', async () => {
    const res = await request(app).get('/api/items/9999');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Item not found');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ price_range_min: 10 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'title is required');
  });

  it('returns 400 for non-numeric price_range_min', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ title: 'Test', price_range_min: 'cheap' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'price_range_min must be a number');
  });

  it('returns 400 when price_range_min exceeds price_range_max', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ title: 'Test', price_range_min: 500, price_range_max: 100 });
    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      'price_range_min must be less than or equal to price_range_max'
    );
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/foo');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
  });
});
