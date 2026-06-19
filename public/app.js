const gridEl = document.getElementById('grid');
const emptyStateEl = document.getElementById('empty-state');
const modalOverlay = document.getElementById('modal-overlay');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const formError = document.getElementById('form-error');
const addBtn = document.getElementById('add-btn');
const emptyAddBtn = document.getElementById('empty-add-btn');
const cancelBtn = document.getElementById('cancel-btn');

let editingId = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatPriceRange(min, max) {
  const hasMin = min != null;
  const hasMax = max != null;
  if (!hasMin && !hasMax) return 'Price not set';
  if (hasMin && hasMax) return `$${min} – $${max}`;
  if (hasMin) return `$${min}+`;
  return `Up to $${max}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = item.id;

  const initial = item.title.trim().charAt(0).toUpperCase() || '?';
  const imageHtml = item.image_url
    ? `<img class="card__image" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card__placeholder\\'>${escapeHtml(initial)}</div>'" />`
    : `<div class="card__placeholder">${escapeHtml(initial)}</div>`;

  const features = item.desired_features || 'No features listed';

  card.innerHTML = `
    <div class="card__image-wrap">${imageHtml}</div>
    <div class="card__body">
      <h2 class="card__title">${escapeHtml(item.title)}</h2>
      <p class="card__features">${escapeHtml(features)}</p>
      <p class="card__price">${escapeHtml(formatPriceRange(item.price_range_min, item.price_range_max))}</p>
    </div>
    <div class="card__actions">
      <button type="button" class="btn btn--ghost btn--small" data-action="edit">Edit</button>
      <button type="button" class="btn btn--danger btn--small" data-action="delete">Delete</button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(item));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteItem(item));

  return card;
}

function renderItems(items) {
  gridEl.innerHTML = '';

  if (items.length === 0) {
    emptyStateEl.hidden = false;
    gridEl.hidden = true;
    return;
  }

  emptyStateEl.hidden = true;
  gridEl.hidden = false;

  for (const item of items) {
    gridEl.appendChild(renderCard(item));
  }
}

async function loadItems() {
  const items = await api('/api/items');
  renderItems(items);
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideFormError() {
  formError.hidden = true;
  formError.textContent = '';
}

function openModal(mode, item = null) {
  editingId = mode === 'edit' ? item.id : null;
  modalTitle.textContent = mode === 'edit' ? 'Edit item' : 'Add item';
  hideFormError();
  itemForm.reset();

  if (item) {
    itemForm.title.value = item.title;
    itemForm.desired_features.value = item.desired_features || '';
    itemForm.price_range_min.value = item.price_range_min ?? '';
    itemForm.price_range_max.value = item.price_range_max ?? '';
    itemForm.image_url.value = item.image_url || '';
  }

  modalOverlay.hidden = false;
  itemForm.title.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  editingId = null;
  hideFormError();
  itemForm.reset();
}

function openAddModal() {
  openModal('add');
}

function openEditModal(item) {
  openModal('edit', item);
}

function getFormPayload() {
  const minVal = itemForm.price_range_min.value.trim();
  const maxVal = itemForm.price_range_max.value.trim();

  return {
    title: itemForm.title.value,
    desired_features: itemForm.desired_features.value.trim() || null,
    price_range_min: minVal === '' ? null : Number(minVal),
    price_range_max: maxVal === '' ? null : Number(maxVal),
    image_url: itemForm.image_url.value.trim() || null,
  };
}

async function handleSubmit(e) {
  e.preventDefault();
  hideFormError();

  const payload = getFormPayload();

  try {
    if (editingId) {
      await api(`/api/items/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    await loadItems();
  } catch (err) {
    showFormError(err.message);
  }
}

async function deleteItem(item) {
  if (!window.confirm(`Delete "${item.title}"?`)) return;

  try {
    await api(`/api/items/${item.id}`, { method: 'DELETE' });
    await loadItems();
  } catch (err) {
    alert(err.message);
  }
}

addBtn.addEventListener('click', openAddModal);
emptyAddBtn.addEventListener('click', openAddModal);
cancelBtn.addEventListener('click', closeModal);
itemForm.addEventListener('submit', handleSubmit);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

loadItems().catch((err) => {
  emptyStateEl.hidden = false;
  gridEl.hidden = true;
  emptyStateEl.querySelector('.empty-state__text').textContent =
    `Failed to load items: ${err.message}`;
});
