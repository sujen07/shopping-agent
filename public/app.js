const gridEl = document.getElementById('grid');
const emptyStateEl = document.getElementById('empty-state');
const modalOverlay = document.getElementById('modal-overlay');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const formError = document.getElementById('form-error');
const addBtn = document.getElementById('add-btn');
const emptyAddBtn = document.getElementById('empty-add-btn');
const cancelBtn = document.getElementById('cancel-btn');
const imageFileInput = document.getElementById('image_file');
const imagePreview = document.getElementById('image-preview');
const imagePreviewImg = document.getElementById('image-preview-img');

let editingId = null;
let existingImageUrl = null;
let pendingFile = null;
let previewObjectUrl = null;

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

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
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

function renderSearchResults(results) {
  if (results.length === 0) {
    return '<p class="card__search-empty">No purchase options found.</p>';
  }

  return results
    .map((result) => {
      const priceHtml = result.price
        ? `<span class="search-result__price">${escapeHtml(result.price)}</span>`
        : '';
      const originalHtml = result.original_price
        ? `<span class="search-result__original">${escapeHtml(result.original_price)}</span>`
        : '';
      const discountHtml = result.discount
        ? `<span class="search-result__discount">${escapeHtml(result.discount)} off</span>`
        : '';

      return `
        <div class="search-result">
          <div class="search-result__header">
            <a class="search-result__site" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.site_name)}</a>
            <span class="search-result__score">${escapeHtml(String(result.trustworthiness_score))}/10</span>
          </div>
          <div class="search-result__pricing">
            ${priceHtml}
            ${originalHtml}
            ${discountHtml}
          </div>
          ${result.notes ? `<p class="search-result__notes">${escapeHtml(result.notes)}</p>` : ''}
        </div>
      `;
    })
    .join('');
}

function setSearchPanelState(panel, { loading, error, results }) {
  const contentEl = panel.querySelector('.card__search-content');
  const toggleBtn = panel.querySelector('.card__search-toggle');

  if (loading) {
    contentEl.innerHTML = '<p class="card__search-loading">Searching…</p>';
    panel.hidden = false;
    panel.dataset.collapsed = 'false';
    toggleBtn.textContent = 'Hide';
    return;
  }

  if (error) {
    contentEl.innerHTML = `<p class="card__search-error">${escapeHtml(error)}</p>`;
    panel.hidden = false;
    panel.dataset.collapsed = 'false';
    toggleBtn.textContent = 'Hide';
    return;
  }

  if (results) {
    contentEl.innerHTML = renderSearchResults(results);
    panel.hidden = false;
    panel.dataset.collapsed = 'false';
    toggleBtn.textContent = 'Hide';
  }
}

function toggleSearchPanel(panel) {
  const collapsed = panel.dataset.collapsed === 'true';
  panel.dataset.collapsed = collapsed ? 'false' : 'true';
  panel.querySelector('.card__search-toggle').textContent = collapsed ? 'Hide' : 'Show';
}

async function searchItemWeb(item, card) {
  const searchBtn = card.querySelector('[data-action="search"]');
  const panel = card.querySelector('.card__search-panel');

  searchBtn.disabled = true;
  setSearchPanelState(panel, { loading: true });

  try {
    const data = await api(`/api/items/${item.id}/search`, { method: 'POST' });
    setSearchPanelState(panel, { results: data.results });
  } catch (err) {
    setSearchPanelState(panel, { error: err.message });
  } finally {
    searchBtn.disabled = false;
  }
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
      <button type="button" class="btn btn--ghost btn--small" data-action="search">Search Web</button>
      <button type="button" class="btn btn--ghost btn--small" data-action="edit">Edit</button>
      <button type="button" class="btn btn--danger btn--small" data-action="delete">Delete</button>
    </div>
    <div class="card__search-panel" hidden data-collapsed="false">
      <div class="card__search-header">
        <span class="card__search-title">Web search results</span>
        <button type="button" class="card__search-toggle">Hide</button>
      </div>
      <div class="card__search-content"></div>
    </div>
  `;

  const searchPanel = card.querySelector('.card__search-panel');

  card.querySelector('[data-action="search"]').addEventListener('click', () => searchItemWeb(item, card));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(item));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteItem(item));
  card.querySelector('.card__search-toggle').addEventListener('click', () => toggleSearchPanel(searchPanel));

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

function clearPreviewObjectUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function updateImagePreview() {
  clearPreviewObjectUrl();

  let src = null;

  if (pendingFile) {
    previewObjectUrl = URL.createObjectURL(pendingFile);
    src = previewObjectUrl;
  } else {
    const urlValue = itemForm.image_url.value.trim();
    if (urlValue) {
      src = urlValue;
    } else if (existingImageUrl) {
      src = existingImageUrl;
    }
  }

  if (src) {
    imagePreviewImg.src = src;
    imagePreview.hidden = false;
  } else {
    imagePreviewImg.removeAttribute('src');
    imagePreview.hidden = true;
  }
}

function resetImageState() {
  clearPreviewObjectUrl();
  pendingFile = null;
  existingImageUrl = null;
  imageFileInput.value = '';
  imagePreviewImg.removeAttribute('src');
  imagePreview.hidden = true;
}

function openModal(mode, item = null) {
  editingId = mode === 'edit' ? item.id : null;
  modalTitle.textContent = mode === 'edit' ? 'Edit item' : 'Add item';
  hideFormError();
  resetImageState();
  itemForm.reset();

  if (item) {
    itemForm.title.value = item.title;
    itemForm.desired_features.value = item.desired_features || '';
    itemForm.price_range_min.value = item.price_range_min ?? '';
    itemForm.price_range_max.value = item.price_range_max ?? '';
    existingImageUrl = item.image_url || null;

    if (item.image_url && /^https?:\/\//i.test(item.image_url)) {
      itemForm.image_url.value = item.image_url;
    }
  }

  updateImagePreview();
  modalOverlay.hidden = false;
  itemForm.title.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  editingId = null;
  hideFormError();
  itemForm.reset();
  resetImageState();
}

function openAddModal() {
  openModal('add');
}

function openEditModal(item) {
  openModal('edit', item);
}

function getFormPayload(imageUrl) {
  const minVal = itemForm.price_range_min.value.trim();
  const maxVal = itemForm.price_range_max.value.trim();

  return {
    title: itemForm.title.value,
    desired_features: itemForm.desired_features.value.trim() || null,
    price_range_min: minVal === '' ? null : Number(minVal),
    price_range_max: maxVal === '' ? null : Number(maxVal),
    image_url: imageUrl,
  };
}

async function resolveImageUrl() {
  if (pendingFile) {
    return uploadImage(pendingFile);
  }

  const urlValue = itemForm.image_url.value.trim();
  if (urlValue) {
    return urlValue;
  }

  if (editingId) {
    return existingImageUrl;
  }

  return null;
}

async function handleSubmit(e) {
  e.preventDefault();
  hideFormError();

  try {
    const imageUrl = await resolveImageUrl();
    const payload = getFormPayload(imageUrl);

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

imageFileInput.addEventListener('change', () => {
  pendingFile = imageFileInput.files[0] || null;
  updateImagePreview();
});

itemForm.image_url.addEventListener('input', () => {
  if (itemForm.image_url.value.trim()) {
    pendingFile = null;
    imageFileInput.value = '';
  }
  updateImagePreview();
});

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
