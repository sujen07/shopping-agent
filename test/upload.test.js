const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.DB_PATH = ':memory:';

const app = require('../src/index');

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('upload API', () => {
  it('POST /api/upload stores an image and returns a URL', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('image', PNG_1x1, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    assert.equal(res.status, 200);
    assert.match(res.body.url, /^\/uploads\/[0-9a-f-]+\.png$/);

    const fileRes = await request(app).get(res.body.url);
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers['content-type'], 'image/png');
  });

  it('POST /api/upload rejects non-image files', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('image', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      'Only JPEG, PNG, GIF, and WebP images are allowed'
    );
  });

  it('POST /api/upload rejects requests without a file', async () => {
    const res = await request(app).post('/api/upload');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'No image file provided');
  });
});
