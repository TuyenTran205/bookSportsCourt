'use client';

import * as React from 'react';
import type { CatalogIconOption } from './catalog-icons';

export interface IconPickerProps {
  options: CatalogIconOption[];
  value?: string;
  onChange: (value: string) => void;
  /** Danh sách icon ID đã được cấu hình / vô hiệu hoá */
  disabledIds?: string[];
  /** Map từ icon ID sang tên môn thể thao đã cấu hình để hiển thị tooltip / lý do */
  disabledReasonMap?: Record<string, string>;
}

export function IconPicker({
  options,
  value,
  onChange,
  disabledIds = [],
  disabledReasonMap = {},
}: IconPickerProps) {
  const selectedOption = options.find((opt) => opt.id === value) ?? options[0];
  const isSelectedDisabled = selectedOption ? disabledIds.includes(selectedOption.id) : false;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-subtle p-2 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <span className="text-text-disabled">Đang chọn:</span>
          {selectedOption && (
            <div className="flex items-center gap-2 font-medium text-text-primary">
              <div className="flex size-7 shrink-0 items-center justify-center">
                <selectedOption.icon className="h-6 w-5" />
              </div>
              <span>{selectedOption.label}</span>
            </div>
          )}
        </div>
        {isSelectedDisabled && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            (Đã có môn dùng biểu tượng này)
          </span>
        )}
      </div>

      <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-border p-2.5 sm:grid-cols-5">
        {options.map((opt) => {
          const isSelected = opt.id === value;
          const isDisabled = disabledIds.includes(opt.id);
          const disabledReason = disabledReasonMap[opt.id];
          const IconComp = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  onChange(opt.id);
                }
              }}
              className={`group relative flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-center transition-all ${
                isDisabled
                  ? 'cursor-not-allowed border-dashed border-border/70 bg-bg-subtle/40 opacity-45 grayscale hover:bg-bg-subtle/40'
                  : isSelected
                    ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-600/30 dark:bg-primary-950/50 dark:text-primary-300'
                    : 'border-transparent text-text-secondary hover:border-border hover:bg-bg-subtle hover:text-text-primary'
              }`}
              title={
                isDisabled
                  ? disabledReason
                    ? `Đã cấu hình (${disabledReason}) - Không thể chọn lại`
                    : 'Đã được cấu hình trong hệ thống'
                  : opt.label
              }
              aria-disabled={isDisabled}
            >
              <div className="flex h-7 w-6 shrink-0 items-center justify-center">
                <IconComp className="h-6 w-5" />
              </div>
              <span className="w-full truncate text-[10px] font-medium leading-tight">
                {opt.label.split(' / ')[0]}
              </span>
              {isDisabled && (
                <span className="inline-block rounded bg-neutral-200/90 px-1 py-0.5 text-[9px] font-medium leading-none text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  Đã có
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
