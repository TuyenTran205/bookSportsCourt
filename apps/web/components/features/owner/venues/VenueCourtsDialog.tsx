'use client';

import * as React from 'react';
import type { Court, VenueDetail } from '@bsc/shared';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
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
import { StatusBadge } from '@/components/ui/status-badge';

interface VenueCourtsDialogProps {
  venue: VenueDetail | null;
  submitting: boolean;
  deletingCourtId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { name: string; sportId: string }) => void;
  onDelete: (court: Court) => void;
}

export function VenueCourtsDialog({
  venue,
  submitting,
  deletingCourtId,
  onOpenChange,
  onCreate,
  onDelete,
}: VenueCourtsDialogProps) {
  const t = useTranslations('owner');
  const [name, setName] = React.useState('');
  const [sportId, setSportId] = React.useState('');
  const [deleteConfirmationId, setDeleteConfirmationId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (venue) {
      setName('');
      setSportId(venue.sports[0]?.id ?? '');
      setDeleteConfirmationId(null);
    }
  }, [venue]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !sportId) return;
    onCreate({ name: name.trim(), sportId });
  };

  return (
    <Dialog
      open={Boolean(venue)}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmationId(null);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-w-lg p-5 sm:p-6" closeLabel={t('close')}>
        {venue && (
          <>
            <DialogHeader>
              <DialogTitle>{t('manageCourtsTitle', { venue: venue.name })}</DialogTitle>
              <DialogDescription>{t('manageCourtsDescription')}</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={submit}
              className="space-y-3 rounded-card border border-neutral-200 bg-neutral-50 p-3"
            >
              <h3 className="text-sm font-semibold text-neutral-900">{t('addCourtSection')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block space-y-1 text-xs font-medium text-neutral-700">
                  <span>{t('courtName')} <span className="text-danger">*</span></span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('courtNamePlaceholder')}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="block space-y-1 text-xs font-medium text-neutral-700">
                  <span>{t('sportLabel')} <span className="text-danger">*</span></span>
                  <NativeSelect
                    value={sportId}
                    onChange={(event) => setSportId(event.target.value)}
                    disabled={venue.sports.length === 0}
                    required
                  >
                    {venue.sports.length === 0 ? (
                      <option value="">{t('venueSportRequired')}</option>
                    ) : (
                      venue.sports.map((sport) => (
                        <option key={sport.id} value={sport.id}>{sport.name}</option>
                      ))
                    )}
                  </NativeSelect>
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  className="min-h-11"
                  disabled={!name.trim() || !sportId}
                  loading={submitting}
                >
                  <Plus aria-hidden="true" />
                  {t('addCourt')}
                </Button>
              </div>
            </form>

            <section className="space-y-2" aria-labelledby="venue-court-list-title">
              <h3 id="venue-court-list-title" className="text-sm font-semibold text-neutral-900">
                {t('courtListCount', { count: venue.courts.length })}
              </h3>
              {venue.courts.length === 0 ? (
                <p className="rounded-card border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
                  {t('noCourtsYet')}
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200">
                  {venue.courts.map((court) => {
                    const sport = venue.sports.find((item) => item.id === court.sportId);
                    const confirming = deleteConfirmationId === court.id;
                    return (
                      <li
                        key={court.id}
                        className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{court.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {sport?.name ?? t('sportUnspecified')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                          <StatusBadge
                            kind="venue"
                            status={court.status === 'active' ? 'approved' : 'suspended'}
                            label={court.status === 'active' ? t('courtActive') : t('courtInactive')}
                            size="sm"
                          />
                          {confirming ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-danger">{t('deleteCourtConfirmShort')}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={Boolean(deletingCourtId)}
                                onClick={() => setDeleteConfirmationId(null)}
                              >
                                {t('cancelAction')}
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                loading={deletingCourtId === court.id}
                                onClick={() => onDelete(court)}
                              >
                                {t('deleteCourt')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 text-danger hover:bg-danger/10"
                              aria-label={t('deleteCourtNamed', { name: court.name })}
                              disabled={Boolean(deletingCourtId)}
                              onClick={() => setDeleteConfirmationId(court.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
