'use client';

import * as React from 'react';
import Image from 'next/image';
import type { Area, Sport, VenueDetail } from '@bsc/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ImagePlus, MapPin, X } from 'lucide-react';
import { listAreas, listSports } from '@/lib/api/endpoints/venues';
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
import { NativeSelect } from '@/components/ui/select';
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
  districtId: string;
  sportIds: string[];
  lat: number;
  lng: number;
  description?: string;
  image?: File;
}

interface VenueFormDialogProps {
  open: boolean;
  venue?: VenueDetail;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: VenueFormInput) => void;
}

export function VenueFormDialog({
  open,
  venue,
  submitting,
  onOpenChange,
  onSubmit,
}: VenueFormDialogProps) {
  const t = useTranslations('owner');
  const provincesQuery = useQuery({
    queryKey: ['areas', 'province'],
    queryFn: () => listAreas({ type: 'province' }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const sportsQuery = useQuery({
    queryKey: ['sports'],
    queryFn: listSports,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [provinceId, setProvinceId] = React.useState('');
  const [districtId, setDistrictId] = React.useState('');
  const [sportIds, setSportIds] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState<MapCoordinates | null>(null);
  const [placingPin, setPlacingPin] = React.useState(false);
  const [image, setImage] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(venue?.name ?? '');
    setAddress(venue?.address ?? '');
    setProvinceId(venue?.provinceId ?? '');
    setDistrictId(venue?.districtId ?? '');
    setSportIds(venue?.sports.map((sport) => sport.id) ?? []);
    setDescription(venue?.description ?? '');
    setLocation(
      venue && Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && (venue.lat !== 0 || venue.lng !== 0)
        ? [venue.lat, venue.lng]
        : null,
    );
    setPlacingPin(false);
    setImage(null);
    setImagePreviewUrl(venue?.images[0]?.url ?? venue?.coverUrl ?? null);
    setImageError('');
    setValidationError('');
  }, [open, venue]);

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const districtsQuery = useQuery({
    queryKey: ['areas', 'district', provinceId],
    queryFn: () => listAreas({ parentId: provinceId }),
    enabled: open && Boolean(provinceId),
    staleTime: 5 * 60 * 1000,
  });
  const provinces = provincesQuery.data ?? [];
  const districts = districtsQuery.data ?? [];
  const sports = sportsQuery.data ?? [];
  const selectedProvince = provinces.find((province) => province.id === provinceId);
  const mapCenter = React.useMemo<MapCoordinates>(() => {
    const name = selectedProvince?.name.toLocaleLowerCase('vi');
    if (name?.includes('hà nội')) return [21.0285, 105.8542];
    if (name?.includes('đà nẵng')) return [16.0471, 108.2068];
    if (name?.includes('cần thơ')) return [10.0452, 105.7469];
    if (name?.includes('bình dương')) return [11.3254, 106.477];
    return [10.7769, 106.7008];
  }, [selectedProvince]);

  const toggleSport = (sportId: string) => {
    setSportIds((current) =>
      current.includes(sportId)
        ? current.filter((id) => id !== sportId)
        : [...current, sportId],
    );
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2 || address.trim().length < 5 || !provinceId || !districtId) {
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
      districtId,
      sportIds,
      lat: location[0],
      lng: location[1],
      description: description.trim() || undefined,
      image: image ?? undefined,
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

  const catalogError = provincesQuery.error ?? sportsQuery.error ?? districtsQuery.error;

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
              void provincesQuery.refetch();
              void sportsQuery.refetch();
              if (provinceId) void districtsQuery.refetch();
            }}
          />
        ) : provincesQuery.isLoading || sportsQuery.isLoading ? (
          <div className="space-y-3" aria-label={t('venueCatalogLoading')}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit} noValidate>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
                <span>{t('provinceLabel')} <span className="text-danger">*</span></span>
                <NativeSelect
                  value={provinceId}
                  onChange={(event) => {
                    setProvinceId(event.target.value);
                    setDistrictId('');
                    setLocation(null);
                  }}
                  required
                >
                  <option value="">{t('selectProvincePlaceholder')}</option>
                  {provinces.map((province: Area) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </NativeSelect>
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-neutral-700">
                <span>{t('districtLabel')} <span className="text-danger">*</span></span>
                <NativeSelect
                  value={districtId}
                  onChange={(event) => {
                    setDistrictId(event.target.value);
                    setLocation(null);
                  }}
                  disabled={!provinceId || districtsQuery.isLoading}
                  required
                >
                  <option value="">{t('selectDistrictPlaceholder')}</option>
                  {districts.map((district: Area) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </NativeSelect>
              </label>
            </div>

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
                  <Button
                    type="button"
                    variant={placingPin ? 'primary' : 'outline'}
                    size="sm"
                    aria-pressed={placingPin}
                    onClick={() => setPlacingPin((current) => !current)}
                  >
                    <MapPin aria-hidden="true" />
                    {placingPin ? t('venuePinSelecting') : t('venuePinAction')}
                  </Button>
                </div>
                <VenueLocationMapWrapper
                  center={mapCenter}
                  marker={location}
                  placingPin={placingPin}
                  onPlacePin={(coordinates) => {
                    setLocation(coordinates);
                    setPlacingPin(false);
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
                        setImagePreviewUrl(venue?.images[0]?.url ?? venue?.coverUrl ?? null);
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
