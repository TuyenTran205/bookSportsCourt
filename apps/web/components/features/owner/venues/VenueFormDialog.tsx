'use client';

import * as React from 'react';
import Image from 'next/image';
import type { Area, Province, Sport, VenueDetail, Ward } from '@bsc/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ImagePlus, Sparkles, X } from 'lucide-react';
import { listAmenities, listSports } from '@/lib/api/endpoints/venues';
import { listAdminUsers, type AdminVenueRow } from '@/lib/api/endpoints/admin';
import { renderCatalogIcon } from '@/components/features/admin/catalog-icons';
import { LocationSelector } from '@/components/common/LocationSelector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/common/ErrorState';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  VenueLocationMapWrapper,
  type MapCoordinates,
} from '@/components/features/venue/VenueLocationMapWrapper';

export interface VenueFormInput {
  name: string;
  address: string;
  provinceId: string;
  provinceCode?: string;
  wardId?: string;
  wardCode?: string;
  districtId?: string;
  sportIds: string[];
  amenityIds?: string[];
  lat: number;
  lng: number;
  description?: string;
  image?: File;
  ownerId?: string;
}

interface VenueFormDialogProps {
  open: boolean;
  venue?: VenueDetail | AdminVenueRow | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: VenueFormInput) => void;
  isAdmin?: boolean;
}

export function VenueFormDialog({
  open,
  venue,
  submitting,
  onOpenChange,
  onSubmit,
  isAdmin,
}: VenueFormDialogProps) {
  const t = useTranslations('owner');
  const sportsQuery = useQuery({
    queryKey: ['sports'],
    queryFn: listSports,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const amenitiesQuery = useQuery({
    queryKey: ['amenities'],
    queryFn: listAmenities,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const ownersQuery = useQuery({
    queryKey: ['admin', 'users', 'owners-select'],
    queryFn: () => listAdminUsers({ role: 'owner', limit: 100 }),
    enabled: open && Boolean(isAdmin),
    staleTime: 5 * 60 * 1000,
  });

  const [ownerId, setOwnerId] = React.useState('');
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [provinceId, setProvinceId] = React.useState('');
  const [provinceCode, setProvinceCode] = React.useState('');
  const [wardId, setWardId] = React.useState('');
  const [wardCode, setWardCode] = React.useState('');
  const [districtId, setDistrictId] = React.useState('');
  const [sportIds, setSportIds] = React.useState<string[]>([]);
  const [amenityIds, setAmenityIds] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState<MapCoordinates | null>(null);
  const [image, setImage] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setOwnerId((venue as { ownerId?: string })?.ownerId ?? '');
    setName(venue?.name ?? '');
    setAddress(venue?.address ?? '');
    setProvinceId(venue?.provinceId ?? (venue as { province?: { id: string } })?.province?.id ?? '');
    setProvinceCode(venue?.province?.code ?? '');
    setWardId((venue as { wardId?: string })?.wardId ?? venue?.ward?.id ?? '');
    setWardCode(venue?.ward?.code ?? '');
    setDistrictId(venue?.districtId ?? (venue as { district?: { id: string } })?.district?.id ?? '');
    setSportIds(venue?.sports?.map((sport) => sport.id) ?? []);
    setAmenityIds(venue?.amenities?.map((amenity) => amenity.id) ?? []);
    setDescription(venue?.description ?? '');
    setLocation(
      venue &&
        typeof venue.lat === 'number' &&
        typeof venue.lng === 'number' &&
        Number.isFinite(venue.lat) &&
        Number.isFinite(venue.lng) &&
        (venue.lat !== 0 || venue.lng !== 0)
        ? [venue.lat, venue.lng]
        : null,
    );
    setImage(null);
    setImagePreviewUrl((venue as { images?: Array<{ url: string }> })?.images?.[0]?.url ?? venue?.coverUrl ?? null);
    setImageError('');
    setValidationError('');
  }, [open, venue]);

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const sports = sportsQuery.data ?? [];
  const amenities = amenitiesQuery.data ?? [];
  const mapCenter = React.useMemo<MapCoordinates>(() => {
    if (provinceCode === '01') return [21.0285, 105.8542];
    if (provinceCode === '79') return [10.7769, 106.7008];
    if (provinceCode === '48') return [16.0471, 108.2068];
    if (provinceCode === '46') return [16.4637, 107.5909];
    if (provinceCode === '31') return [20.8449, 106.6881];
    if (provinceCode === '92') return [10.0452, 105.7469];
    if (provinceCode === '74') return [11.3254, 106.477];
    return [10.7769, 106.7008];
  }, [provinceCode]);

  const toggleSport = (sportId: string) => {
    setSportIds((current) =>
      current.includes(sportId)
        ? current.filter((id) => id !== sportId)
        : [...current, sportId],
    );
  };

  const toggleAmenity = (amenityId: string) => {
    setAmenityIds((current) =>
      current.includes(amenityId)
        ? current.filter((id) => id !== amenityId)
        : [...current, amenityId],
    );
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAdmin && !venue && !ownerId) {
      setValidationError('Vui lòng chọn chủ sân sở hữu cơ sở');
      return;
    }
    if (name.trim().length < 2 || address.trim().length < 5 || !provinceId || (!wardId && !districtId)) {
      setValidationError(t('venueRequiredFields'));
      return;
    }
    if (!location) {
      setValidationError(t('venuePinRequired'));
      return;
    }
    if (sportIds.length === 0) {
      setValidationError(t('venueSportRequired'));
      return;
    }
    if (imageError) return;
    setValidationError('');
    onSubmit({
      name: name.trim(),
      address: address.trim(),
      provinceId,
      provinceCode: provinceCode || undefined,
      wardId: wardId || undefined,
      wardCode: wardCode || undefined,
      districtId: districtId || undefined,
      sportIds,
      amenityIds,
      lat: location[0],
      lng: location[1],
      description: description.trim() || undefined,
      image: image ?? undefined,
      ownerId: ownerId || undefined,
    });
  };

  const selectImage = (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError(t('venueImageTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError(t('venueImageSizeError'));
      return;
    }

    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const catalogError = sportsQuery.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 sm:p-6" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{venue ? t('editVenue') : t('addVenue')}</DialogTitle>
          <DialogDescription>{t('venueFormDescription')}</DialogDescription>
        </DialogHeader>
        {catalogError ? (
          <ErrorState
            error={catalogError}
            onRetry={() => {
              void sportsQuery.refetch();
            }}
          />
        ) : sportsQuery.isLoading ? (
          <div className="space-y-3" aria-label={t('venueCatalogLoading')}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit} noValidate>
            {isAdmin && (
              <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
                <span>Chủ sân sở hữu {!venue && <span className="text-danger">*</span>}</span>
                <select
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="w-full rounded-btn border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- Chọn chủ sân phụ trách --</option>
                  {(ownersQuery.data?.data ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName} ({o.phone ? `SĐT: ${o.phone}` : o.email})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
              <span>{t('venueNameLabel')} <span className="text-danger">*</span></span>
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('venueNamePlaceholder')}
                maxLength={200}
                required
              />
            </label>

            <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
              <span>{t('venueAddressLabel')} <span className="text-danger">*</span></span>
              <Input
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setLocation(null);
                }}
                placeholder={t('venueAddressPlaceholder')}
                maxLength={500}
                required
              />
            </label>

            <LocationSelector
              provinceId={provinceId}
              provinceCode={provinceCode}
              wardId={wardId}
              wardCode={wardCode}
              onProvinceChange={(p) => {
                setProvinceId(p?.id ?? '');
                setProvinceCode(p?.code ?? '');
                setWardId('');
                setWardCode('');
                setDistrictId('');
                setLocation(null);
              }}
              onWardChange={(w) => {
                setWardId(w?.id ?? '');
                setWardCode(w?.code ?? '');
                setLocation(null);
              }}
              layout="horizontal"
            />

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-neutral-700">
                {t('venueSportsLabel')} <span className="text-danger">*</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {sports.map((sport: Sport) => {
                  const selected = sportIds.includes(sport.id);
                  return (
                    <button
                      key={sport.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSport(sport.id)}
                      className={`min-h-9 rounded-btn border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                        selected
                          ? 'border-primary-700 bg-primary-700 font-medium text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {sport.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {amenities.length > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium text-neutral-700">
                  Tiện ích cơ sở (tuỳ chọn)
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map((amenity) => {
                    const selected = amenityIds.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-btn border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                          selected
                            ? 'border-primary-700 bg-primary-700 font-medium text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {renderCatalogIcon(amenity.icon, Sparkles, 'size-3.5')}
                        <span>{amenity.name}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
              <span>{t('venueDescriptionLabel')}</span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('venueDescriptionPlaceholder')}
                maxLength={5000}
                rows={3}
              />
            </label>

            {address.trim().length >= 5 && (
              <section aria-labelledby="venue-location-heading" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 id="venue-location-heading" className="text-xs font-semibold text-neutral-800">
                      {t('venueLocationTitle')}
                    </h3>
                    <p className="text-xs text-neutral-500">{t('venueLocationHint')}</p>
                  </div>
                  {location && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-neutral-500 hover:text-danger"
                      onClick={() => {
                        setLocation(null);
                        setValidationError('');
                      }}
                    >
                      <X aria-hidden="true" />
                      {t('venuePinClear')}
                    </Button>
                  )}
                </div>
                <VenueLocationMapWrapper
                  center={mapCenter}
                  marker={location}
                  onPlacePin={(coordinates) => {
                    setLocation(coordinates);
                    setValidationError('');
                  }}
                />
                {location ? (
                  <p className="text-xs text-primary-700">
                    {t('venuePinCoordinates', {
                      lat: location[0].toFixed(6),
                      lng: location[1].toFixed(6),
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-warning">{t('venuePinRequired')}</p>
                )}
              </section>
            )}

            <section aria-labelledby="venue-image-heading" className="space-y-2">
              <div>
                <h3 id="venue-image-heading" className="text-xs font-semibold text-neutral-800">
                  {t('venueCoverLabel')}
                </h3>
                <p className="text-xs text-neutral-500">{t('venueImageHint')}</p>
              </div>
              {imagePreviewUrl && (
                <div className="relative aspect-video overflow-hidden rounded-btn border border-neutral-200 bg-neutral-100">
                  <Image
                    src={imagePreviewUrl}
                    alt={t('venueImagePreviewAlt')}
                    fill
                    unoptimized={imagePreviewUrl.startsWith('blob:') || imagePreviewUrl.startsWith('data:')}
                    sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover"
                  />
                  {image && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-2 bg-white"
                      aria-label={t('venueImageClear')}
                      onClick={() => {
                        setImage(null);
                        setImagePreviewUrl((venue as { images?: Array<{ url: string }> })?.images?.[0]?.url ?? venue?.coverUrl ?? null);
                        setImageError('');
                      }}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-btn border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-600">
                <ImagePlus className="size-4" aria-hidden="true" />
                {image ? t('venueImageChange') : t('venueImageChoose')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => selectImage(event.target.files?.[0])}
                />
              </label>
              {imageError && <p role="alert" className="text-sm text-danger">{imageError}</p>}
            </section>

            {validationError && (
              <p role="alert" className="text-sm text-danger">{validationError}</p>
            )}

            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t('cancelAction')}
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? t('savingVenue') : t('saveVenue')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
