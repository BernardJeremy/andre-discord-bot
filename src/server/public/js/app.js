// Shared utilities
document.addEventListener('DOMContentLoaded', () => {
  // Auto-close mobile nav on link click
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Could add mobile menu toggle here
    });
  });
});

/**
 * Format a date string for display
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get a short preview of a log payload
 */
function getLogPreview(log) {
  const p = log.payload || {};
  switch (log.eventType) {
    case 'user_message':
      return p.content || '';
    case 'llm_request':
      return `${p.model || ''} – ${p.messages?.length || 0} messages (iter ${p.iteration || 0})`;
    case 'llm_response':
      if (p.hasToolCalls && p.toolCalls) {
        return `Tool calls: ${p.toolCalls.map(tc => tc.name).join(', ')}`;
      }
      return (p.content || '').substring(0, 100);
    case 'tool_invocation':
      return `${p.toolName} – ${JSON.stringify(p.args || {}).substring(0, 80)}`;
    case 'tool_result':
      return `${p.toolName} – ${p.success ? '✅' : '❌'} ${(p.result || '').substring(0, 80)}`;
    case 'agent_error':
      return p.error || '';
    case 'agent_response':
      return (p.response || '').substring(0, 100);
    case 'scheduler_event':
      return `${p.eventName} – ${p.description || ''}`;
    default:
      return JSON.stringify(p).substring(0, 100);
  }
}

/**
 * Create a badge HTML for an event type
 */
function createBadge(eventType) {
  const label = eventType.replace(/_/g, ' ');
  return `<span class="badge badge-${eventType}">${label}</span>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
