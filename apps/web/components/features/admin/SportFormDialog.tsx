'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/errors';
import { useCreateSport } from '@/lib/hooks/useAdminCatalogs';

const sportFormSchema = z.object({
  name: z.string().min(2, 'Tên môn thể thao ít nhất 2 ký tự').max(50),
  icon: z.string().optional(),
});

type SportFormData = z.infer<typeof sportFormSchema>;

export interface SportFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SportFormDialog({ open, onClose }: SportFormDialogProps) {
  const tCommon = useTranslations('common');
  const createMutation = useCreateSport();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SportFormData>({
    resolver: zodResolver(sportFormSchema),
    defaultValues: {
      name: '',
      icon: 'activity',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ name: '', icon: 'activity' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        icon: values.icon?.trim() || 'activity',
      });
      toast.success(`Đã thêm môn thể thao "${values.name}"`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm môn thể thao mới</DialogTitle>
          <DialogDescription>
            Định nghĩa môn thể thao mới cho hệ thống để các chủ sân có thể lựa chọn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
          <FormField
            label="Tên môn thể thao"
            htmlFor="sport-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="sport-name"
              placeholder="Ví dụ: Bóng bàn, Cầu lông, Bơi lội..."
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Tên icon Lucide (tuỳ chọn)"
            htmlFor="sport-icon"
            error={errors.icon?.message}
            hint="Tên biểu tượng Lucide (ví dụ: activity, trophy, dumbbell, target)"
          >
            <Input
              id="sport-icon"
              placeholder="activity"
              {...register('icon')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? tCommon('loading') : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
