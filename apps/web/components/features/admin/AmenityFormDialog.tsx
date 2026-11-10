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
import { useCreateAmenity } from '@/lib/hooks/useAdminCatalogs';
import { IconPicker } from './IconPicker';
import { AMENITY_ICON_OPTIONS } from './catalog-icons';

const amenityFormSchema = z.object({
  name: z.string().min(2, 'Tên tiện ích ít nhất 2 ký tự').max(50),
  icon: z.string().default('sparkles'),
});

type AmenityFormData = z.infer<typeof amenityFormSchema>;

export interface AmenityFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AmenityFormDialog({ open, onClose }: AmenityFormDialogProps) {
  const tCommon = useTranslations('common');
  const createMutation = useCreateAmenity();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AmenityFormData>({
    resolver: zodResolver(amenityFormSchema),
    defaultValues: {
      name: '',
      icon: 'sparkles',
    },
  });

  const selectedIcon = watch('icon');

  React.useEffect(() => {
    if (open) {
      reset({ name: '', icon: 'sparkles' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        icon: values.icon?.trim() || 'sparkles',
      });
      toast.success(`Đã thêm tiện ích "${values.name}"`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tiện ích cơ sở mới</DialogTitle>
          <DialogDescription>
            Định nghĩa tiện ích mới để các chủ sân có thể gắn vào cơ sở thể thao của họ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
          <FormField
            label="Tên tiện ích"
            htmlFor="amenity-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="amenity-name"
              placeholder="Ví dụ: Trạm sạc xe điện EV, Khán đài cổ vũ, Sauna..."
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Chọn biểu tượng (Icon)"
            htmlFor="amenity-icon"
            hint="Chọn biểu tượng phù hợp cho tiện ích từ danh sách có sẵn"
          >
            <IconPicker
              options={AMENITY_ICON_OPTIONS}
              value={selectedIcon}
              onChange={(iconId) => setValue('icon', iconId)}
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
