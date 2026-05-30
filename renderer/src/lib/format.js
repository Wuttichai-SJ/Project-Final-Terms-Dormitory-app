// Shared text formatters used across renderer pages.

// Thai phone: 10 digits → XXX-XXX-XXXX
export function formatPhone(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// Thai national ID: 13 digits → X-XXXX-XXXXX-XX-X
export function formatIdCard(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 13);
  const parts = [];
  if (d.length >= 1)  parts.push(d.slice(0, 1));
  if (d.length >= 2)  parts.push(d.slice(1, 5));
  if (d.length >= 6)  parts.push(d.slice(5, 10));
  if (d.length >= 11) parts.push(d.slice(10, 12));
  if (d.length >= 13) parts.push(d.slice(12, 13));
  return parts.join('-');
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount || 0);
}

// Display dates in Thai locale (Gregorian calendar — Buddhist conversion skipped for dev clarity)
export function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
