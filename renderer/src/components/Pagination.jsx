import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE = 10;

export function Pagination({ page, pageSize = PAGE_SIZE, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  function go(p) {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  }

  return (
    <div className="flex items-center justify-end gap-4 mt-4">
      <p className="text-xs text-slate-400">
        หน้า <span className="font-medium text-slate-600">{page}</span> / {totalPages} ·{' '}
        <span className="font-medium text-slate-600">{total}</span> รายการ
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page === 1}
          aria-label="หน้าก่อนหน้า"
          className="flex items-center justify-center w-8 h-8 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`gap-${i}`} className="w-8 text-xs text-center text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                p === page
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => go(page + 1)}
          disabled={page === totalPages}
          aria-label="หน้าถัดไป"
          className="flex items-center justify-center w-8 h-8 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Compact page list: first, last, current ±1, with ellipses between gaps.
// e.g. current=5 of 12 → [1, '...', 4, 5, 6, '...', 12]
function buildPageList(current, total) {
  const keep = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...keep].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('...');
    out.push(sorted[i]);
  }
  return out;
}
