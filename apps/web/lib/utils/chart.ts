import type * as React from 'react';

/**
 * Shared dark-mode-safe Recharts tooltip style props using CSS semantic design tokens.
 */
export const RECHARTS_TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-card)',
  borderColor: 'var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text-primary)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
};

export const RECHARTS_TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--color-text-primary)',
  fontWeight: 600,
  marginBottom: '4px',
};

export const RECHARTS_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
};

export const RECHARTS_TOOLTIP_PROPS = {
  contentStyle: RECHARTS_TOOLTIP_CONTENT_STYLE,
  labelStyle: RECHARTS_TOOLTIP_LABEL_STYLE,
  itemStyle: RECHARTS_TOOLTIP_ITEM_STYLE,
  cursor: { fill: 'var(--color-bg-subtle)', opacity: 0.6 },
} as const;
