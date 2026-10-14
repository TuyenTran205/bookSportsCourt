'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { ApiError } from '@/lib/api/errors';
import { useCreateCourt, useDeleteCourt } from '@/lib/hooks/useOwnerVenuesManager';

const courtFormSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sân con').max(100),
  sportId: z.string().min(1, 'Vui lòng chọn môn thể thao'),
  description: z.string().max(1000).optional(),
});

type CourtFormData = z.infer<typeof courtFormSchema>;

export interface CourtsManagerModalProps {
  venue: VenueDetail | null;
  onClose: () => void;
}

export function CourtsManagerModal({ venue, onClose }: CourtsManagerModalProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const createMutation = useCreateCourt();
  const deleteMutation = useDeleteCourt();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourtFormData>({
    resolver: zodResolver(courtFormSchema),
    defaultValues: {
      name: '',
      sportId: venue?.sports[0]?.id ?? '',
      description: '',
    },
  });

  React.useEffect(() => {
    if (venue) {
      reset({
        name: '',
        sportId: venue.sports[0]?.id ?? '',
        description: '',
      });
    }
  }, [venue, reset]);

  const onAddCourt = handleSubmit(async (values) => {
    if (!venue) return;
    try {
      await createMutation.mutateAsync({
        venueId: venue.id,
        input: {
          name: values.name,
          sportId: values.sportId,
          description: values.description?.trim() || undefined,
        },
      });
      toast.success('Đã thêm sân con thành công');
      reset({
        name: '',
        sportId: venue.sports[0]?.id ?? '',
        description: '',
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  const handleDeleteCourt = async (courtId: string, courtName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá ${courtName}?`)) return;
    try {
      await deleteMutation.mutateAsync(courtId);
      toast.success(t('deleteCourtSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  if (!venue) return null;

  return (
    <Dialog open={venue !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('manageCourts')} – {venue.name}
          </DialogTitle>
          <DialogDescription>
            Danh sách các sân con thuộc cơ sở này. Bạn có thể thêm sân mới hoặc xoá sân khi không có đơn đặt đang hoạt động.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* Form thêm sân mới */}
          <form
            onSubmit={onAddCourt}
            className="rounded-card border border-neutral-200 bg-neutral-50 p-4"
          >
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">{t('addCourt')}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={t('courtName')} htmlFor="new-court-name" required error={errors.name?.message}>
                <Input
                  id="new-court-name"
                  placeholder="Ví dụ: Sân 1 (VIP), Sân 2..."
                  {...register('name')}
                />
              </FormField>

              <FormField label="Môn thể thao" htmlFor="new-court-sport" required error={errors.sportId?.message}>
                <NativeSelect id="new-court-sport" {...register('sportId')}>
                  {venue.sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {createMutation.isPending ? tCommon('loading') : t('addCourt')}
              </Button>
            </div>
          </form>

          {/* Danh sách sân con hiện tại */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-neutral-900">
              Danh sách sân ({venue.courts.length})
            </h4>

            {venue.courts.length === 0 ? (
              <p className="rounded-card border border-dashed border-neutral-200 py-6 text-center text-sm text-neutral-500">
                Cơ sở này chưa có sân con nào. Vui lòng thêm sân ở biểu mẫu trên.
              </p>
            ) : (
              <div className="divide-y divide-neutral-100 rounded-card border border-neutral-200 bg-white">
                {venue.courts.map((court) => {
                  const sport = venue.sports.find((s) => s.id === court.sportId);
                  return (
                    <div
                      key={court.id}
                      className="flex items-center justify-between p-3 transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <p className="font-medium text-neutral-900">{court.name}</p>
                        <p className="text-xs text-neutral-500">
                          {sport?.name ?? 'Môn thể thao'} · ID: {court.id.slice(0, 8)}…
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDeleteCourt(court.id, court.name)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                        title={t('deleteCourt')}
                        aria-label={t('deleteCourt')}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
