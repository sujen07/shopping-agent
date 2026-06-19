function formatPriceRange(min, max) {
  const hasMin = min != null;
  const hasMax = max != null;
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) return `$${min}-$${max}`;
  if (hasMin) return `$${min}+`;
  return `up to $${max}`;
}

function buildSearchQuery(item) {
  const parts = [item.title.trim()];

  if (item.desired_features && item.desired_features.trim()) {
    parts.push(item.desired_features.trim());
  }

  const priceText = formatPriceRange(item.price_range_min, item.price_range_max);
  if (priceText) {
    parts.push(`buy price ${priceText}`);
  } else {
    parts.push('buy');
  }

  return parts.join(' ');
}

module.exports = { buildSearchQuery, formatPriceRange };
