'use client';

import * as React from 'react';
import type { CatalogIconOption } from './catalog-icons';

export interface IconPickerProps {
  options: CatalogIconOption[];
  value?: string;
  onChange: (value: string) => void;
}

export function IconPicker({ options, value, onChange }: IconPickerProps) {
  const selectedOption = options.find((opt) => opt.id === value) ?? options[0];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle p-2 text-xs text-text-secondary">
        <span className="text-text-disabled">Đang chọn:</span>
        {selectedOption && (
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <div className="flex size-6 items-center justify-center rounded bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400">
              <selectedOption.icon className="size-3.5" />
            </div>
            <span>{selectedOption.label}</span>
          </div>
        )}
      </div>

      <div className="grid max-h-48 grid-cols-4 sm:grid-cols-5 gap-2 overflow-y-auto rounded-lg border border-border p-2.5">
        {options.map((opt) => {
          const isSelected = opt.id === value;
          const IconComp = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-center transition-all ${
                isSelected
                  ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-600/30 dark:bg-primary-950/50 dark:text-primary-300'
                  : 'border-transparent text-text-secondary hover:border-border hover:bg-bg-subtle hover:text-text-primary'
              }`}
              title={opt.label}
            >
              <IconComp className="size-5" />
              <span className="w-full truncate text-[10px] leading-tight">
                {opt.label.split(' / ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
