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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/errors';
import { useCreateArea, useProvincesList } from '@/lib/hooks/useAdminCatalogs';

const areaFormSchema = z.object({
  name: z.string().min(2, 'Tên khu vực ít nhất 2 ký tự').max(100),
  type: z.enum(['province', 'district']),
  parentId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'district' && !data.parentId) {
      return false;
    }
    return true;
  },
  {
    message: 'Vui lòng chọn tỉnh/thành phố trực thuộc',
    path: ['parentId'],
  },
);

type AreaFormData = z.infer<typeof areaFormSchema>;

export interface AreaFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AreaFormDialog({ open, onClose }: AreaFormDialogProps) {
  const tCommon = useTranslations('common');
  const createMutation = useCreateArea();
  const provincesQuery = useProvincesList();

  const provinces = React.useMemo(() => provincesQuery.data ?? [], [provincesQuery.data]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      name: '',
      type: 'district',
      parentId: '',
    },
  });

  const selectedType = watch('type');
  const selectedParentId = watch('parentId');

  React.useEffect(() => {
    if (open) {
      reset({ name: '', type: 'district', parentId: provinces[0]?.id ?? '' });
    }
  }, [open, reset, provinces]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        type: values.type,
        parentId: values.type === 'district' ? values.parentId : undefined,
      });
      toast.success(`Đã thêm khu vực "${values.name}"`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm địa bàn / khu vực</DialogTitle>
          <DialogDescription>
            Định nghĩa tỉnh/thành hoặc quận/huyện mới cho hệ thống định vị tìm kiếm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Loại địa bàn</label>
            <Select
              value={selectedType}
              onValueChange={(val) => {
                setValue('type', val as 'province' | 'district');
                if (val === 'province') {
                  setValue('parentId', undefined);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại địa bàn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="district">Quận / Huyện</SelectItem>
                <SelectItem value="province">Tỉnh / Thành phố trực thuộc Trung ương</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedType === 'district' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Tỉnh / Thành phố trực thuộc</label>
              <Select
                value={selectedParentId}
                onValueChange={(val) => setValue('parentId', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tỉnh/thành phố" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.parentId && (
                <p className="text-xs text-danger">{errors.parentId.message}</p>
              )}
            </div>
          )}

          <FormField
            label="Tên địa bàn"
            htmlFor="area-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="area-name"
              placeholder={selectedType === 'province' ? 'Ví dụ: Hải Phòng, Cần Thơ...' : 'Ví dụ: Quận 3, Quận Đống Đa...'}
              {...register('name')}
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
