'use client';

import * as React from 'react';
import type { Court, VenueDetail } from '@bsc/shared';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
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

const COURTS_PAGE_SIZE = 8;

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
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (venue) {
      setName('');
      setSportId(venue.sports[0]?.id ?? '');
      setDeleteConfirmationId(null);
      setPage(1);
    }
  }, [venue]);

  const courts = venue?.courts ?? [];
  const totalPages = Math.max(1, Math.ceil(courts.length / COURTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedCourts = courts.slice(
    (safePage - 1) * COURTS_PAGE_SIZE,
    safePage * COURTS_PAGE_SIZE,
  );

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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-5 sm:p-6" closeLabel={t('close')}>
        {venue && (
          <>
            <DialogHeader>
              <DialogTitle>{t('manageCourtsTitle', { venue: venue.name })}</DialogTitle>
              <DialogDescription>{t('manageCourtsDescription')}</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={submit}
              className="space-y-3 rounded-card border border-border bg-bg-subtle p-3"
            >
              <h3 className="text-sm font-semibold text-text-primary">{t('addCourtSection')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block space-y-1 text-xs font-medium text-text-secondary">
                  <span>{t('courtName')} <span className="text-danger">*</span></span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('courtNamePlaceholder')}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="block space-y-1 text-xs font-medium text-text-secondary">
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

            <section className="space-y-3" aria-labelledby="venue-court-list-title">
              <h3 id="venue-court-list-title" className="text-sm font-semibold text-text-primary">
                {t('courtListCount', { count: courts.length })}
              </h3>
              {courts.length === 0 ? (
                <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                  {t('noCourtsYet')}
                </p>
              ) : (
                <div className="space-y-3">
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {paginatedCourts.map((court) => {
                      const sport = venue.sports.find((item) => item.id === court.sportId);
                      const confirming = deleteConfirmationId === court.id;
                      return (
                        <li
                          key={court.id}
                          className="flex flex-col justify-between gap-2 rounded-card border border-border bg-bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text-primary">{court.name}</p>
                              <p className="mt-0.5 truncate text-xs text-text-secondary">
                                {sport?.name ?? t('sportUnspecified')}
                              </p>
                            </div>
                            <StatusBadge
                              kind="venue"
                              status={court.status === 'active' ? 'approved' : 'suspended'}
                              label={court.status === 'active' ? t('courtActive') : t('courtInactive')}
                              size="sm"
                            />
                          </div>

                          <div className="flex items-center justify-end border-t border-border pt-2">
                            {confirming ? (
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <span className="mr-auto text-[11px] text-danger">{t('deleteCourtConfirmShort')}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={Boolean(deletingCourtId)}
                                  onClick={() => setDeleteConfirmationId(null)}
                                >
                                  {t('cancelAction')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
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
                                size="sm"
                                className="h-7 px-2 text-xs text-danger hover:bg-danger/10 hover:text-danger"
                                aria-label={t('deleteCourtNamed', { name: court.name })}
                                disabled={Boolean(deletingCourtId)}
                                onClick={() => setDeleteConfirmationId(court.id)}
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                                {t('deleteCourt')}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    total={courts.length}
                    limit={COURTS_PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
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
