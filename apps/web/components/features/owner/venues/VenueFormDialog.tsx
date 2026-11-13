'use client';

import * as React from 'react';
import Image from 'next/image';
import type { Area, Province, Sport, VenueDetail, Ward } from '@bsc/shared';
import { PROVINCES } from '@bsc/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImagePlus, Loader2, LocateFixed, MapPin, Navigation, Sparkles, X } from 'lucide-react';
import { listAmenities, listSports, listWards } from '@/lib/api/endpoints/venues';
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
import {
  geocodeAddress,
  parseAddressQuery,
  reverseGeocodeDetails,
  matchProvinceFromLocation,
  matchWardFromLocation,
  getProvinceCenter,
} from '@/lib/utils/geocoding';

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
  const [provinceName, setProvinceName] = React.useState('');
  const [wardId, setWardId] = React.useState('');
  const [wardCode, setWardCode] = React.useState('');
  const [wardName, setWardName] = React.useState('');
  const [districtId, setDistrictId] = React.useState('');
  const [sportIds, setSportIds] = React.useState<string[]>([]);
  const [amenityIds, setAmenityIds] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState<MapCoordinates | null>(null);
  const [pinnedAddress, setPinnedAddress] = React.useState<string | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);
  const [image, setImage] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState('');
  const [validationError, setValidationError] = React.useState('');
  const shouldAutoLocateRef = React.useRef(false);
  const locateRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    shouldAutoLocateRef.current = false;
    locateRequestIdRef.current += 1;
    setOwnerId((venue as { ownerId?: string })?.ownerId ?? '');
    setName(venue?.name ?? '');
    setAddress(venue?.address ?? '');
    setProvinceId(venue?.provinceId ?? (venue as { province?: { id: string } })?.province?.id ?? '');
    setProvinceCode(venue?.province?.code ?? '');
    setProvinceName((venue as { province?: { name: string } })?.province?.name ?? '');
    setWardId((venue as { wardId?: string })?.wardId ?? venue?.ward?.id ?? '');
    setWardCode(venue?.ward?.code ?? '');
    setWardName((venue as { ward?: { name: string } })?.ward?.name ?? '');
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
    setPinnedAddress(venue?.address ?? null);
    setIsLocating(false);
    setIsReverseGeocoding(false);
    setIsGettingLocation(false);
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
  const initialCenter = React.useMemo<MapCoordinates>(() => {
    if (venue && typeof venue.lat === 'number' && typeof venue.lng === 'number') {
      return [venue.lat, venue.lng];
    }
    if (provinceCode) {
      return getProvinceCenter(provinceCode);
    }
    return [21.0285, 105.8542];
  }, [provinceCode, venue]);

  const handleResolveLocation = React.useCallback(
    async (lat: number, lng: number, options?: { silent?: boolean }) => {
      setIsReverseGeocoding(true);
      try {
        const details = await reverseGeocodeDetails(lat, lng);
        if (!details) return;

        setPinnedAddress(details.formattedAddress);

        // Tự động nhận diện Tỉnh / Thành phố từ vị trí
        const matchedProvince = matchProvinceFromLocation(details);
        if (matchedProvince) {
          const fullProvince = PROVINCES.find((p) => p.code === matchedProvince.code) ?? matchedProvince;
          const provTarget = fullProvince.code || fullProvince.id;
          setProvinceId(fullProvince.id);
          setProvinceCode(fullProvince.code ?? '');
          setProvinceName(fullProvince.name);

          // Tự động lấy danh sách Xã / Phường của tỉnh đó để match
          try {
            const wards = await listWards(provTarget, { limit: 100 });
            const matchedWard = matchWardFromLocation(wards, details);
            if (matchedWard) {
              setWardId(matchedWard.id);
              setWardCode(matchedWard.code ?? '');
              setWardName(matchedWard.name);
              setDistrictId('');
              if (!options?.silent) {
                toast.success(`Đã tự động chọn: ${fullProvince.name} - ${matchedWard.name}`);
              }
            } else {
              setWardId('');
              setWardCode('');
              setWardName('');
              setDistrictId('');
              if (!options?.silent) {
                toast.success(`Đã tự động chọn: ${fullProvince.name}`);
              }
            }
          } catch {
            if (!options?.silent) {
              toast.success(`Đã tự động chọn: ${fullProvince.name}`);
            }
          }
        }
      } catch (err) {
        console.error('Lỗi khi tra cứu địa chỉ từ tọa độ:', err);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [],
  );

  const handleGetCurrentLocation = React.useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords: MapCoordinates = [latitude, longitude];
        shouldAutoLocateRef.current = false;
        setLocation(coords);
        setValidationError('');
        setIsGettingLocation(false);
        void handleResolveLocation(latitude, longitude);
      },
      (error) => {
        setIsGettingLocation(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Vui lòng cho phép quyền truy cập vị trí trong trình duyệt của bạn.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Thông tin vị trí hiện không khả dụng.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Yêu cầu lấy vị trí bị quá thời gian chờ.';
        }
        toast.error(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [handleResolveLocation]);

  const handleLocateAddress = React.useCallback(
    async (customAddress?: string, options?: { silent?: boolean }) => {
      const text = (customAddress ?? address).trim();
      if (!text && !wardName && !provinceName) return;

      const requestId = ++locateRequestIdRef.current;
      shouldAutoLocateRef.current = false;
      setIsLocating(true);
      try {
        const parsedText = text ? parseAddressQuery(text) : null;
        const textHasProvince = Boolean(parsedText?.province);
        const rawQueries: string[] = [];

        if (text) {
          if (textHasProvince) {
            // Địa chỉ đã ghi rõ tỉnh/thành: ưu tiên tìm nguyên bản trước để tránh nhiễu khi ghép thêm tên hành chính
            rawQueries.push(text);
          } else {
            if (provinceName) {
              rawQueries.push([text, provinceName].filter(Boolean).join(', '));
            }
            if (wardName && provinceName) {
              rawQueries.push([text, wardName, provinceName].filter(Boolean).join(', '));
            }
            rawQueries.push(text);
          }
        }

        if (!options?.silent) {
          if (wardName && provinceName) {
            rawQueries.push([wardName, provinceName].join(', '));
          } else if (provinceName) {
            rawQueries.push(provinceName);
          }
        }

        const queries = rawQueries.filter((q, index) => q && rawQueries.indexOf(q) === index);
        const biasProvince = parsedText?.province ?? (provinceCode ? { code: provinceCode } : null);
        const focusCenter = biasProvince?.code ? getProvinceCenter(biasProvince.code) : null;

        let foundCoords: [number, number] | null = null;
        for (const query of queries) {
          const coords = await geocodeAddress(query, {
            focusLat: focusCenter?.[0],
            focusLng: focusCenter?.[1],
            preferredProvince: parsedText?.province?.name ?? (provinceName || undefined),
          });
          if (requestId !== locateRequestIdRef.current) return;
          if (coords) {
            foundCoords = coords;
            break;
          }
        }

        if (foundCoords) {
          setLocation(foundCoords);
          setValidationError('');
          void handleResolveLocation(foundCoords[0], foundCoords[1], { silent: options?.silent });
        } else if (!options?.silent) {
          toast.error('Không tìm thấy vị trí phù hợp. Vui lòng thử bấm trực tiếp lên bản đồ để cắm ghim.');
        }
      } finally {
        if (requestId === locateRequestIdRef.current) {
          setIsLocating(false);
        }
      }
    },
    [address, wardName, provinceName, provinceCode, handleResolveLocation],
  );

  // Tự động kéo bản đồ khi người dùng gõ xong địa chỉ trên form
  React.useEffect(() => {
    if (!open || !shouldAutoLocateRef.current) return undefined;
    const text = address.trim();
    if (text.length < 5) return undefined;

    const timer = setTimeout(() => {
      void handleLocateAddress(text, { silent: true });
    }, 800);

    return () => clearTimeout(timer);
  }, [address, open, handleLocateAddress]);

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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="venue-address-input" className="text-xs font-medium text-neutral-700">
                  {t('venueAddressLabel')} <span className="text-danger">*</span>
                </label>
                {address.trim().length >= 3 && (
                  <button
                    type="button"
                    onClick={() => void handleLocateAddress()}
                    disabled={isLocating}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Đang định vị...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="size-3" />
                        <span>Định vị trên bản đồ</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <Input
                id="venue-address-input"
                value={address}
                onChange={(event) => {
                  shouldAutoLocateRef.current = true;
                  setAddress(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleLocateAddress();
                  }
                }}
                placeholder={t('venueAddressPlaceholder')}
                maxLength={500}
                required
              />
            </div>

            <LocationSelector
              provinceId={provinceId}
              provinceCode={provinceCode}
              wardId={wardId}
              wardCode={wardCode}
              onProvinceChange={(p) => {
                setProvinceId(p?.id ?? '');
                setProvinceCode(p?.code ?? '');
                setProvinceName(p?.name ?? '');
                setWardId('');
                setWardCode('');
                setWardName('');
                setDistrictId('');
              }}
              onWardChange={(w) => {
                setWardId(w?.id ?? '');
                setWardCode(w?.code ?? '');
                setWardName(w?.name ?? '');
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

            <section aria-labelledby="venue-location-heading" className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="venue-location-heading" className="text-xs font-semibold text-neutral-800">
                    {t('venueLocationTitle')} <span className="text-danger">*</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Bấm vào bản đồ để cắm ghim hoặc bấm &ldquo;Vị trí của tôi&rdquo; để tự điền Tỉnh và Xã
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs text-primary-700 hover:bg-primary-50 hover:text-primary-800 border-primary-200"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation ? (
                      <Loader2 className="size-3.5 animate-spin mr-1" aria-hidden="true" />
                    ) : (
                      <LocateFixed className="size-3.5 mr-1 text-primary-600" aria-hidden="true" />
                    )}
                    <span>Vị trí của tôi</span>
                  </Button>
                  {location && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-neutral-500 hover:text-danger"
                      onClick={() => {
                        setLocation(null);
                        setPinnedAddress(null);
                        setValidationError('');
                      }}
                    >
                      <X className="size-3.5 mr-0.5" aria-hidden="true" />
                      {t('venuePinClear')}
                    </Button>
                  )}
                </div>
              </div>
              <VenueLocationMapWrapper
                center={initialCenter}
                marker={location}
                scrollWheelZoom={true}
                onPlacePin={(coordinates) => {
                  shouldAutoLocateRef.current = false;
                  locateRequestIdRef.current += 1;
                  setLocation(coordinates);
                  setValidationError('');
                  void handleResolveLocation(coordinates[0], coordinates[1]);
                }}
                onLocateMe={handleGetCurrentLocation}
                isLocatingMe={isGettingLocation}
              />
              {location ? (
                <div className="rounded-btn border border-primary-200 bg-primary-50/70 p-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-primary-900">
                        <MapPin className="size-3.5 shrink-0 text-primary-600" />
                        <span>
                          {t('venuePinCoordinates', {
                            lat: location[0].toFixed(6),
                            lng: location[1].toFixed(6),
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-neutral-700">
                        {isReverseGeocoding ? (
                          <span className="inline-flex items-center gap-1 text-neutral-500">
                            <Loader2 className="size-3 animate-spin" /> Đang tra cứu địa điểm...
                          </span>
                        ) : pinnedAddress ? (
                          <span>
                            <span className="font-semibold text-neutral-800">Địa điểm: </span>
                            {pinnedAddress}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Chưa xác định được tên địa điểm cụ thể</span>
                        )}
                      </p>
                    </div>
                    {pinnedAddress && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 bg-white text-xs font-medium text-primary-700 hover:bg-primary-100 hover:text-primary-800"
                        onClick={() => {
                          shouldAutoLocateRef.current = false;
                          setAddress(pinnedAddress);
                        }}
                      >
                        Dùng làm địa chỉ
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-warning flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{t('venuePinRequired')}</span>
                </p>
              )}
            </section>

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
