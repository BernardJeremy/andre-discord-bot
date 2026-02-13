// Logs page logic
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('filters-form');
  const container = document.getElementById('logs-container');
  const paginationEl = document.getElementById('pagination');
  const paginationInfo = document.getElementById('pagination-info');
  const clearBtn = document.getElementById('clear-filters');
  const modal = document.getElementById('log-modal');
  const modalBody = document.getElementById('modal-body');
  const modalClose = modal?.querySelector('.modal-close');
  const modalBackdrop = modal?.querySelector('.modal-backdrop');

  if (!form || !container) return;

  let currentPage = 1;

  // Load logs on page load
  loadLogs();

  // Filter form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    currentPage = 1;
    loadLogs();
  });

  // Clear filters
  clearBtn?.addEventListener('click', () => {
    form.reset();
    currentPage = 1;
    loadLogs();
  });

  // Modal close
  modalClose?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);

  async function loadLogs() {
    container.innerHTML = '<p class="loading">Loading logs...</p>';

    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('limit', '50');

    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (value) params.set(key, value.toString());
    }

    try {
      const resp = await fetch(`/api/logs?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to load logs');
      const result = await resp.json();

      renderLogs(result);
      renderPagination(result);
    } catch (err) {
      container.innerHTML = `<p class="empty-state">Error loading logs: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderLogs(result) {
    if (result.data.length === 0) {
      container.innerHTML = '<p class="empty-state">No logs found matching your filters.</p>';
      paginationInfo.textContent = '0 results';
      return;
    }

    paginationInfo.textContent = `Showing ${(result.page - 1) * result.limit + 1}–${Math.min(result.page * result.limit, result.total)} of ${result.total}`;

    container.innerHTML = result.data.map(log => `
      <div class="log-entry" data-id="${log._id}" data-conversation="${log.conversationId}">
        <span class="log-entry-time">${formatDate(log.timestamp)}</span>
        <span class="log-entry-type">${createBadge(log.eventType)}</span>
        <span class="log-entry-preview">${escapeHtml(getLogPreview(log))}</span>
        <span class="log-entry-user">${escapeHtml(log.userId)}</span>
        <span class="log-entry-conv"><a href="/conversation/${log.conversationId}" title="View conversation" onclick="event.stopPropagation()">${log.conversationId.substring(0, 8)}…</a></span>
      </div>
    `).join('');

    // Add click handlers for detail view
    container.querySelectorAll('.log-entry').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        showLogDetail(id);
      });
    });
  }

  function renderPagination(result) {
    if (result.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ Prev</button>`;

    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(result.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
      html += `<button data-page="1">1</button>`;
      if (startPage > 2) html += `<button disabled>…</button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button data-page="${i}" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }

    if (endPage < result.totalPages) {
      if (endPage < result.totalPages - 1) html += `<button disabled>…</button>`;
      html += `<button data-page="${result.totalPages}">${result.totalPages}</button>`;
    }

    html += `<button ${currentPage >= result.totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next ›</button>`;

    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        loadLogs();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  async function showLogDetail(id) {
    if (!modal || !modalBody) return;

    modal.style.display = 'flex';
    modalBody.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const resp = await fetch(`/api/logs/${id}`);
      if (!resp.ok) throw new Error('Failed to load log detail');
      const log = await resp.json();

      modalBody.innerHTML = `
        <div style="margin-bottom: 1rem;">
          ${createBadge(log.eventType)}
          <span class="timeline-time" style="margin-left: 0.5rem;">${formatDate(log.timestamp)}</span>
        </div>
        <div style="margin-bottom: 0.75rem;">
          <strong>User:</strong> ${escapeHtml(log.userId)}<br>
          <strong>Channel:</strong> ${escapeHtml(log.channelId)}<br>
          <strong>Conversation:</strong> <a href="/conversation/${log.conversationId}">${escapeHtml(log.conversationId)}</a>
        </div>
        <h4 style="margin-bottom: 0.5rem;">Payload</h4>
        <pre class="content-pre">${escapeHtml(JSON.stringify(log.payload, null, 2))}</pre>
        ${Object.keys(log.metadata || {}).length > 0 ? `
          <h4 style="margin: 0.75rem 0 0.5rem;">Metadata</h4>
          <pre class="content-pre">${escapeHtml(JSON.stringify(log.metadata, null, 2))}</pre>
        ` : ''}
      `;
    } catch (err) {
      modalBody.innerHTML = `<p class="empty-state">Error: ${escapeHtml(err.message)}</p>`;
    }
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});
