let currentLightboxPath = null;
let currentLightboxFilename = null;

async function showGalleryView() {
  document.querySelectorAll('.panel-screen').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-gallery').classList.add('active');

  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '<p style="color:var(--text-muted)">Buscando capturas (F2)...</p>';

  try {
    const screenshots = await window.api.getScreenshots();

    if (!screenshots || screenshots.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: rgba(20, 15, 43, 0.4); border-radius: 16px; border: 1px dashed var(--border-subtle);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted); margin-bottom: 12px;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p style="color: var(--text-secondary); margin-bottom: 8px;">Aún no tienes capturas de pantalla guardadas.</p>
          <small style="color: var(--text-muted);">Presiona <strong>F2</strong> mientras juegas para capturar momentos inolvidables de los eventos.</small>
        </div>
      `;
      return;
    }

    grid.innerHTML = screenshots.map(s => `
      <div class="screenshot-card" onclick="openScreenshotPreview('${encodeURI(s.url)}', '${escapeJs(s.filename)}', '${escapeJs(s.path)}')">
        <div class="screenshot-thumb-box">
          <img src="${s.url}" alt="${s.filename}" loading="lazy">
          <div class="screenshot-actions-overlay" onclick="event.stopPropagation()">
            <button class="btn-gallery-action btn-copy" title="Copiar captura" onclick="copyScreenshotAction(event, '${escapeJs(s.path)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copiar</span>
            </button>
            <button class="btn-gallery-action btn-delete" title="Borrar captura" onclick="deleteScreenshotAction(event, '${escapeJs(s.path)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Borrar</span>
            </button>
          </div>
        </div>
        <div class="screenshot-info">
          <div class="screenshot-name" title="${s.filename}">${s.filename}</div>
          <div class="screenshot-date">${new Date(s.date).toLocaleDateString()} &bull; ${formatBytes(s.size)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--danger)">Error al cargar galería de capturas.</p>';
  }
}

async function copyScreenshotAction(event, filePath) {
  if (event) event.stopPropagation();
  try {
    const res = await window.api.copyScreenshot(filePath);
    if (res && res.success) {
      showToast('📋 Captura copiada al portapapeles');
    } else {
      showToast('❌ Error al copiar la captura');
    }
  } catch (err) {
    showToast('❌ Error al copiar');
  }
}

async function deleteScreenshotAction(event, filePath) {
  if (event) event.stopPropagation();
  if (!confirm('¿Deseas eliminar permanentemente esta captura de pantalla?')) return;
  try {
    const res = await window.api.deleteScreenshot(filePath);
    if (res && res.success) {
      showToast('🗑️ Captura eliminada');
      showGalleryView();
    } else {
      showToast(`❌ Error: ${res?.error || 'No se pudo eliminar'}`);
    }
  } catch (err) {
    showToast('❌ Error al eliminar');
  }
}

function openScreenshotsInExplorer() {
  window.api.openScreenshotsFolder();
}

function openScreenshotPreview(url, filename, path) {
  currentLightboxPath = path;
  currentLightboxFilename = filename;
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox-caption').textContent = filename;
  openModal('modal-screenshot-preview');
}

async function copyCurrentLightboxScreenshot() {
  if (!currentLightboxPath) return;
  try {
    const res = await window.api.copyScreenshot(currentLightboxPath);
    if (res && res.success) {
      showToast('📋 Captura copiada al portapapeles');
    } else {
      showToast('❌ Error al copiar');
    }
  } catch (err) {
    showToast('❌ Error al copiar');
  }
}

async function showCurrentLightboxInFolder() {
  if (!currentLightboxPath) return;
  await window.api.showScreenshotInFolder(currentLightboxPath);
}

async function deleteCurrentLightboxScreenshot() {
  if (!currentLightboxPath) return;
  if (!confirm('¿Deseas eliminar permanentemente esta captura de pantalla?')) return;
  try {
    const res = await window.api.deleteScreenshot(currentLightboxPath);
    if (res && res.success) {
      closeModal('modal-screenshot-preview');
      showToast('🗑️ Captura eliminada');
      showGalleryView();
    } else {
      showToast(`❌ Error: ${res?.error || 'No se pudo eliminar'}`);
    }
  } catch (err) {
    showToast('❌ Error al eliminar');
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeJs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
