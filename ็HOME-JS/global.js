window.API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api' : '/api';

window.formatDateLabel = function (s) {
    if (!s) return '—';
    const d = new Date(s); if (isNaN(d)) return s;
    const day = d.getDate(), month = d.getMonth() + 1, yearBE = d.getFullYear() + 543;
    return `${day}/${month}/${yearBE.toString().slice(-2)}`;
};
window.escapeHtml = (t = '') => t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));