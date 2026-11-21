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
import { useCreateSport, useSportsList } from '@/lib/hooks/useAdminCatalogs';
import { IconPicker } from './IconPicker';
import { SPORT_ICON_OPTIONS } from './catalog-icons';

const SLUG_TO_ICON: Record<string, string> = {
  'cau-long': 'badminton',
  'bong-da': 'soccer',
  'pickleball': 'pickleball',
  'tennis': 'tennis',
  'quan-vot': 'tennis',
  'bong-ro': 'basketball',
  'bong-chuyen': 'volleyball',
  'bong-ban': 'table-tennis',
  'boi-loi': 'swimming',
  gym: 'gym',
  'chay-bo': 'running',
  'dien-kinh': 'running',
  golf: 'golf',
  bida: 'billiards',
  billiards: 'billiards',
  'vo-thuat': 'martial-arts',
  bowling: 'bowling',
  'ban-cung': 'archery',
  'dua-xe-dap': 'cycling',
  'leo-nui': 'climbing',
  'truot-patin': 'skating',
  yoga: 'yoga',
};

const sportFormSchema = z.object({
  name: z.string().min(2, 'Tên môn thể thao ít nhất 2 ký tự').max(50),
  icon: z.string().min(1, 'Vui lòng chọn biểu tượng'),
});

type SportFormData = z.infer<typeof sportFormSchema>;

export interface SportFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SportFormDialog({ open, onClose }: SportFormDialogProps) {
  const tCommon = useTranslations('common');
  const createMutation = useCreateSport();
  const sportsQuery = useSportsList();

  // Tính toán các môn / biểu tượng đã được cấu hình trong hệ thống
  const { disabledIconIds, disabledReasonMap, defaultIcon } = React.useMemo(() => {
    const existingSports = sportsQuery.data ?? [];
    const reasonMap: Record<string, string> = {};

    for (const sport of existingSports) {
      const sportName = sport.name;
      if (sport.icon && sport.icon !== 'general') {
        reasonMap[sport.icon.toLowerCase().trim()] = sportName;
      }
      if (sport.slug) {
        const slugKey = sport.slug.toLowerCase().trim();
        if (SLUG_TO_ICON[slugKey] && SLUG_TO_ICON[slugKey] !== 'general') {
          reasonMap[SLUG_TO_ICON[slugKey]] = sportName;
        }
        reasonMap[slugKey] = sportName;
      }
    }

    const disabledList = SPORT_ICON_OPTIONS.filter(
      (opt) => opt.id !== 'general' && Boolean(reasonMap[opt.id]),
    ).map((opt) => opt.id);

    // Mặc định chọn biểu tượng đầu tiên CHƯA được cấu hình
    const firstAvailable =
      SPORT_ICON_OPTIONS.find((opt) => !disabledList.includes(opt.id))?.id ?? 'general';

    return {
      disabledIconIds: disabledList,
      disabledReasonMap: reasonMap,
      defaultIcon: firstAvailable,
    };
  }, [sportsQuery.data]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SportFormData>({
    resolver: zodResolver(sportFormSchema),
    defaultValues: {
      name: '',
      icon: defaultIcon,
    },
  });

  const selectedIcon = watch('icon');

  React.useEffect(() => {
    if (open) {
      reset({ name: '', icon: defaultIcon });
    }
  }, [open, reset, defaultIcon]);

  const onSubmit = handleSubmit(async (values) => {
    // Chặn người dùng gửi icon đã bị vô hiệu hoá
    if (values.icon !== 'general' && disabledIconIds.includes(values.icon)) {
      const reason = disabledReasonMap[values.icon];
      toast.error(
        `Biểu tượng này đã được sử dụng cho môn "${reason}". Vui lòng chọn biểu tượng khác.`,
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        icon: values.icon?.trim() || 'general',
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
              placeholder="Ví dụ: Bóng bàn, Bơi lội, Cầu mây..."
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Chọn biểu tượng (Icon)"
            htmlFor="sport-icon"
            hint="Các biểu tượng đã được cấu hình cho môn khác sẽ bị làm mờ và không thể chọn lại."
          >
            <IconPicker
              options={SPORT_ICON_OPTIONS}
              value={selectedIcon}
              onChange={(iconId) => setValue('icon', iconId)}
              disabledIds={disabledIconIds}
              disabledReasonMap={disabledReasonMap}
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
