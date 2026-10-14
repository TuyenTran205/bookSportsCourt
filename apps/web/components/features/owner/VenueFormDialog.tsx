'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { VenueDetail } from '@bsc/shared';

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
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import {
  useCreateVenue,
  useDistricts,
  useProvinces,
  useSports,
  useUpdateVenue,
} from '@/lib/hooks/useOwnerVenuesManager';

const formSchema = z.object({
  name: z.string().min(2, 'Vui lòng nhập tên cơ sở (tối thiểu 2 ký tự)').max(200),
  address: z.string().min(5, 'Vui lòng nhập địa chỉ (tối thiểu 5 ký tự)').max(500),
  provinceId: z.string().min(1, 'Vui lòng chọn Tỉnh/Thành phố'),
  districtId: z.string().min(1, 'Vui lòng chọn Quận/Huyện'),
  sportIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một môn thể thao'),
  description: z.string().max(5000).optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface VenueFormDialogProps {
  open: boolean;
  onClose: () => void;
  venueToEdit?: VenueDetail | null;
}

export function VenueFormDialog({ open, onClose, venueToEdit }: VenueFormDialogProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const provincesQuery = useProvinces();
  const sportsQuery = useSports();
  const createMutation = useCreateVenue();
  const updateMutation = useUpdateVenue();

  const isEditing = Boolean(venueToEdit);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      provinceId: '',
      districtId: '',
      sportIds: [],
      description: '',
    },
  });

  const selectedProvinceId = watch('provinceId');
  const selectedSportIds = watch('sportIds');
  const districtsQuery = useDistricts(selectedProvinceId);

  React.useEffect(() => {
    if (open) {
      if (venueToEdit) {
        reset({
          name: venueToEdit.name,
          address: venueToEdit.address,
          provinceId: venueToEdit.provinceId ?? venueToEdit.province?.id ?? '',
          districtId: venueToEdit.districtId ?? venueToEdit.district?.id ?? '',
          sportIds: venueToEdit.sports.map((s) => s.id),
          description: venueToEdit.description ?? '',
        });
      } else {
        reset({
          name: '',
          address: '',
          provinceId: provincesQuery.data?.[0]?.id ?? '',
          districtId: '',
          sportIds: sportsQuery.data?.[0] ? [sportsQuery.data[0].id] : [],
          description: '',
        });
      }
    }
  }, [open, venueToEdit, provincesQuery.data, sportsQuery.data, reset]);

  const toggleSport = (sportId: string) => {
    const current = selectedSportIds || [];
    if (current.includes(sportId)) {
      setValue(
        'sportIds',
        current.filter((id) => id !== sportId),
        { shouldValidate: true },
      );
    } else {
      setValue('sportIds', [...current, sportId], { shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && venueToEdit) {
        await updateMutation.mutateAsync({
          id: venueToEdit.id,
          input: {
            name: values.name,
            address: values.address,
            description: values.description,
          },
        });
        toast.success('Đã cập nhật cơ sở thành công');
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          address: values.address,
          provinceId: values.provinceId,
          districtId: values.districtId,
          sportIds: values.sportIds,
          description: values.description,
        });
        toast.success('Đã gửi thông tin cơ sở mới, đang chờ duyệt');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editVenue') : t('addVenue')}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Chỉnh sửa thông tin cơ sở thể thao của bạn.'
              : 'Thêm cơ sở thể thao mới vào hệ thống. Cơ sở mới sẽ vào danh sách chờ kiểm duyệt.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Tên cơ sở"
            htmlFor="venue-name"
            required
            error={errors.name?.message}
          >
            <Input id="venue-name" placeholder="Ví dụ: Sân Cầu Lông Thăng Long" {...register('name')} />
          </FormField>

          <FormField
            label="Địa chỉ chi tiết"
            htmlFor="venue-address"
            required
            error={errors.address?.message}
          >
            <Input id="venue-address" placeholder="Số nhà, đường, phường/xã..." {...register('address')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Tỉnh/Thành phố"
              htmlFor="venue-province"
              required
              error={errors.provinceId?.message}
            >
              <NativeSelect id="venue-province" {...register('provinceId')}>
                <option value="">-- Chọn Tỉnh/Thành --</option>
                {provincesQuery.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField
              label="Quận/Huyện"
              htmlFor="venue-district"
              required
              error={errors.districtId?.message}
            >
              <NativeSelect id="venue-district" {...register('districtId')}>
                <option value="">-- Chọn Quận/Huyện --</option>
                {districtsQuery.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          <FormField
            label="Môn thể thao hỗ trợ"
            htmlFor="venue-sports"
            required
            error={errors.sportIds?.message}
          >
            <div className="flex flex-wrap gap-2 pt-1">
              {sportsQuery.data?.map((s) => {
                const checked = selectedSportIds?.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSport(s.id)}
                    className={`rounded-btn px-3 py-1.5 text-xs font-medium transition-colors ${
                      checked
                        ? 'bg-primary-600 text-white'
                        : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField
            label="Giới thiệu cơ sở"
            htmlFor="venue-description"
            error={errors.description?.message}
          >
            <Textarea
              id="venue-description"
              rows={3}
              placeholder="Mô tả cơ sở vật chất, thảm sàn, ánh sáng, dịch vụ..."
              {...register('description')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon('loading') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
