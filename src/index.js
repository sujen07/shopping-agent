const express = require('express');
const itemsRouter = require('./routes/items');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/items', itemsRouter);

app.listen(PORT, () => {
  console.log(`Wishlist app listening on http://localhost:${PORT}`);
});
