'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Trash2, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

export type ConfirmDialogVariant = 'primary' | 'warning' | 'danger';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  description: React.ReactNode;
  note?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isPending?: boolean;
  icon?: LucideIcon;
  onConfirm: () => void | Promise<void>;
}

const VARIANT_CONFIG: Record<
  ConfirmDialogVariant,
  {
    defaultIcon: LucideIcon;
    iconWrapperClass: string;
    buttonVariant: 'primary' | 'danger';
    buttonClassName?: string;
  }
> = {
  primary: {
    defaultIcon: CheckCircle2,
    iconWrapperClass: 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400',
    buttonVariant: 'primary',
  },
  warning: {
    defaultIcon: AlertTriangle,
    iconWrapperClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    buttonVariant: 'primary',
    buttonClassName: 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800',
  },
  danger: {
    defaultIcon: Trash2,
    iconWrapperClass: 'bg-danger/10 text-danger',
    buttonVariant: 'danger',
  },
};

/**
 * Hộp thoại xác nhận dùng chung thay thế `window.confirm` mặc định của trình duyệt.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  note,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'primary',
  isPending = false,
  icon,
  onConfirm,
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = icon ?? config.defaultIcon;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-w-md" closeLabel="Đóng">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                config.iconWrapperClass,
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base text-text-primary">{title}</DialogTitle>
              {subtitle && (
                <DialogDescription className="text-xs text-text-secondary">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1 text-sm text-text-secondary">
          <div>{description}</div>
          {note && (
            <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text-secondary">
              {note}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            className={config.buttonClassName}
            loading={isPending}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
