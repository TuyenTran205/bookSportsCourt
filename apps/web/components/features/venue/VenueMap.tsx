'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { LngLatBounds, Marker, Popup } from 'maplibre-gl';
import {
  Bike,
  CircleDot,
  Dribbble,
  Dumbbell,
  ExternalLink,
  Feather,
  Flag,
  Goal,
  ImageOff,
  Loader2,
  LocateFixed,
  MapPin,
  Star,
  Table2,
  Trophy,
  Volleyball,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Sport, VenueListItem } from '@bsc/shared';

import { buttonVariants } from '@/components/ui/button';
import { prewarmPmTilesForCoordinates } from '@/lib/map/pmtiles-protocol';
import { getTileProviders } from '@/lib/map/tile-providers';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { TileResilienceProvider } from './map/TileResilienceContext';
import { MapLibreCanvas, ResilientTileLayer, useMapLibre } from './map/ResilientTileLayer';
import { MapResilienceControl } from './map/MapResilienceControl';
import { VietnamMaritimeLayer } from './map/VietnamMaritimeLayer';

const SPORT_PIN_ICONS: Record<string, LucideIcon> = {
  // Cầu lông
  badminton: Feather,
  'cau-long': Feather,
  feather: Feather,
  // Bóng đá
  soccer: Goal,
  football: Goal,
  'bong-da': Goal,
  'bong-da-mini': Goal,
  goal: Goal,
  // Bóng rổ
  basketball: Dribbble,
  'bong-ro': Dribbble,
  'circle-dashed': Dribbble,
  // Bóng chuyền
  volleyball: Volleyball,
  'bong-chuyen': Volleyball,
  // Pickleball / Bóng bàn
  pickleball: Table2,
  'table-2': Table2,
  'bong-ban': Table2,
  // Tennis / Quần vợt
  tennis: CircleDot,
  'quan-vot': CircleDot,
  circle: CircleDot,
  'circle-dot': CircleDot,
  // Gym / Bơi lội / Golf / Đạp xe
  dumbbell: Dumbbell,
  gym: Dumbbell,
  waves: Waves,
  swimming: Waves,
  'boi-loi': Waves,
  flag: Flag,
  golf: Flag,
  bike: Bike,
  cycling: Bike,
  trophy: Trophy,
};

function resolveSingleSportIcon(sport: Sport): LucideIcon {
  const candidates = [sport.slug, sport.icon]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());

  for (const key of candidates) {
    const matched = SPORT_PIN_ICONS[key];
    if (matched) return matched;
  }

  return Trophy;
}

/** Lấy danh sách tối đa 3 icon Lucide duy nhất đại diện đúng các môn của cơ sở. */
function resolveVenueSportIcons(venue: VenueListItem): LucideIcon[] {
  const sports = venue.sports ?? [];
  if (sports.length === 0) {
    return [MapPin];
  }

  const icons: LucideIcon[] = [];
  for (const sport of sports) {
    const icon = resolveSingleSportIcon(sport);
    if (!icons.includes(icon)) {
      icons.push(icon);
    }
    if (icons.length >= 3) break;
  }

  return icons.length > 0 ? icons : [MapPin];
}

function isValidCoordinate(
  venue: VenueListItem,
): venue is VenueListItem & { lat: number; lng: number } {
  return (
    typeof venue.lat === 'number' &&
    typeof venue.lng === 'number' &&
    !Number.isNaN(venue.lat) &&
    !Number.isNaN(venue.lng)
  );
}

const USER_LOCATION_DRIFT_METERS = 200;

function getActivePmTilesUrl(): string | null {
  const provider = getTileProviders().find((item) => item.format === 'pmtiles');
  return provider?.url ?? null;
}

function isWithinVietnamRegion([lng, lat]: [number, number]): boolean {
  return lng >= 101 && lng <= 118 && lat >= 6 && lat <= 24.5;
}

/** Khoảng cách Haversine (mét) để nhận biết người dùng đã di map sang khu vực khác. */
function distanceInMeters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pin icon đại diện các môn thể thao của cơ sở trên bản đồ.
 * Lưu ý: Phần tử gốc truyền vào `new Marker({ element })` tuyệt đối KHÔNG gắn
 * `transition-transform` hoặc `scale`, nếu không vị trí marker sẽ bị trượt đuổi theo
 * MapLibre trong lúc `flyTo`/pan/zoom. Hiệu ứng phóng to khi chọn chỉ đặt ở `<button>` con.
 */
function VenueMarkerPin({
  venue,
  isSelected,
  onSelect,
}: {
  venue: VenueListItem;
  isSelected: boolean;
  onSelect: (venue: VenueListItem) => void;
}) {
  const icons = resolveVenueSportIcons(venue);
  const sportNames = (venue.sports ?? []).map((sport) => sport.name).join(', ');
  const label = sportNames ? `${venue.name} (${sportNames})` : venue.name;
  const hasMultipleIcons = icons.length > 1;

  return (
    <button
      type="button"
      onMouseEnter={() => {
        const pmtilesUrl = getActivePmTilesUrl();
        if (pmtilesUrl && isValidCoordinate(venue)) {
          void prewarmPmTilesForCoordinates(pmtilesUrl, [[venue.lng, venue.lat]], {
            zooms: [12, 14],
            radius: 1,
            maxCenters: 1,
          });
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(venue);
      }}
      aria-label={label}
      aria-pressed={isSelected}
      title={label}
      className={cn(
        'group relative flex origin-bottom flex-col items-center pb-[2px] focus-visible:outline-none',
        'transition-transform duration-150',
        isSelected ? 'scale-110' : 'hover:scale-105',
      )}
    >
      <span
        className={cn(
          'relative z-[1] flex h-7 items-center justify-center rounded-full border-[1.5px] shadow-md transition-colors duration-150',
          'group-focus-visible:ring-2 group-focus-visible:ring-primary-600 group-focus-visible:ring-offset-2',
          hasMultipleIcons ? 'gap-1 px-2' : 'w-7',
          isSelected
            ? 'border-white bg-primary-600 text-white shadow-lg'
            : 'border-primary-600 bg-bg-card text-primary-700 group-hover:bg-primary-50',
        )}
      >
        {icons.map((SportIcon, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-3 w-px shrink-0',
                  isSelected ? 'bg-white/40' : 'bg-primary-200',
                )}
              />
            )}
            <SportIcon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          </React.Fragment>
        ))}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative z-[2] -mt-1 size-2 rotate-45 border-b-[1.5px] border-r-[1.5px] transition-colors duration-150',
          isSelected
            ? 'border-white bg-primary-600'
            : 'border-primary-600 bg-bg-card group-hover:bg-primary-50',
        )}
      />
    </button>
  );
}

/** Cập nhật khung nhìn bản đồ tự động theo sân được chọn hoặc danh sách cơ sở. */
function MapBoundsUpdater({
  venues,
  selectedVenue,
  hasUserLocation,
}: {
  venues: VenueListItem[];
  selectedVenue?: VenueListItem | null;
  hasUserLocation: boolean;
}) {
  const map = useMapLibre();
  const prevVenuesKeyRef = React.useRef<string | null>(null);
  const prevSelectedIdRef = React.useRef<string | null>(null);

  const venuesKey = React.useMemo(
    () => venues.map((v) => `${v.id}:${v.lat ?? ''},${v.lng ?? ''}`).join('|'),
    [venues],
  );

  React.useEffect(() => {
    if (!map) return;

    const selectedId = selectedVenue?.id ?? null;
    if (selectedVenue && isValidCoordinate(selectedVenue)) {
      if (prevSelectedIdRef.current !== selectedId) {
        prevSelectedIdRef.current = selectedId;

        const pmtilesUrl = getActivePmTilesUrl();
        if (pmtilesUrl) {
          void prewarmPmTilesForCoordinates(pmtilesUrl, [[selectedVenue.lng, selectedVenue.lat]], {
            zooms: [12, 14],
            radius: 1,
            maxCenters: 1,
          });
        }

        map.flyTo({
          center: [selectedVenue.lng, selectedVenue.lat],
          zoom: 15,
          duration: 900,
        });
      }
      return;
    }
    prevSelectedIdRef.current = null;

    const isInitialLoad = prevVenuesKeyRef.current === null;
    const isVenuesChanged = prevVenuesKeyRef.current !== venuesKey;
    prevVenuesKeyRef.current = venuesKey;

    if (!isVenuesChanged) return;
    // Nếu lần đầu đã định vị người dùng thì ưu tiên giữ tâm ở vị trí hiện tại
    if (isInitialLoad && hasUserLocation) return;

    const validPoints = venues
      .filter(isValidCoordinate)
      .map((v) => [v.lng, v.lat] as [number, number]);

    if (validPoints.length === 1 && validPoints[0]) {
      map.flyTo({ center: validPoints[0], zoom: 15, duration: 600 });
      return;
    }

    if (validPoints.length > 1) {
      const bounds = new LngLatBounds();
      for (const point of validPoints) {
        bounds.extend(point);
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 600 });
    }
  }, [hasUserLocation, map, selectedVenue, venues, venuesKey]);

  return null;
}

/** Hiển thị chấm xanh vị trí hiện tại của người dùng & điều phối quay về vị trí đó. */
function UserLocationLayer({
  userLocation,
  recenterSignal,
  hasSelectedVenue,
  onAwayChange,
}: {
  userLocation: [number, number] | null;
  recenterSignal: number;
  hasSelectedVenue: boolean;
  onAwayChange: (isAway: boolean) => void;
}) {
  const map = useMapLibre();
  const hasAutoCenteredRef = React.useRef(false);
  const hasUserInteractedRef = React.useRef(false);
  const lastHandledSignalRef = React.useRef(0);
  const onAwayChangeRef = React.useRef(onAwayChange);

  React.useEffect(() => {
    onAwayChangeRef.current = onAwayChange;
  }, [onAwayChange]);

  const userLng = userLocation?.[0];
  const userLat = userLocation?.[1];

  // Vẽ chấm xanh đánh dấu vị trí hiện tại người dùng trên bản đồ
  React.useEffect(() => {
    if (!map || userLng === undefined || userLat === undefined) return undefined;

    const root = document.createElement('div');
    root.style.zIndex = '15';
    root.setAttribute('aria-label', 'Vị trí hiện tại của bạn');

    const wrap = document.createElement('div');
    wrap.className = 'relative flex size-6 items-center justify-center';

    const halo = document.createElement('span');
    halo.className = 'absolute size-6 animate-ping rounded-full bg-blue-500/30';
    halo.setAttribute('aria-hidden', 'true');

    const dot = document.createElement('span');
    dot.className =
      'relative size-3.5 rounded-full border-2 border-white bg-blue-600 shadow-md ring-2 ring-blue-500/30';
    dot.setAttribute('aria-hidden', 'true');

    wrap.appendChild(halo);
    wrap.appendChild(dot);
    root.appendChild(wrap);

    const marker = new Marker({ element: root, anchor: 'center' })
      .setLngLat([userLng, userLat])
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, userLat, userLng]);

  // Theo dõi người dùng kéo/di map để hiện trạng thái lệch vị trí
  React.useEffect(() => {
    if (!map) return undefined;

    const markInteracted = () => {
      hasUserInteractedRef.current = true;
    };

    const evaluateCenterDistance = () => {
      if (userLng === undefined || userLat === undefined) {
        onAwayChangeRef.current(false);
        return;
      }
      const center = map.getCenter();
      const away =
        distanceInMeters([center.lng, center.lat], [userLng, userLat]) > USER_LOCATION_DRIFT_METERS;
      onAwayChangeRef.current(away);
    };

    map.on('dragstart', markInteracted);
    map.on('wheel', markInteracted);
    map.on('move', evaluateCenterDistance);
    map.on('moveend', evaluateCenterDistance);

    return () => {
      map.off('dragstart', markInteracted);
      map.off('wheel', markInteracted);
      map.off('move', evaluateCenterDistance);
      map.off('moveend', evaluateCenterDistance);
    };
  }, [map, userLat, userLng]);

  // Tự động bay về vị trí hiện tại lúc mới mở map hoặc khi người dùng bấm nút định vị
  React.useEffect(() => {
    if (!map || userLng === undefined || userLat === undefined) return;

    const isManualRecenter = recenterSignal > lastHandledSignalRef.current;
    if (isManualRecenter) {
      lastHandledSignalRef.current = recenterSignal;
      onAwayChangeRef.current(false);
      map.flyTo({ center: [userLng, userLat], zoom: 14, duration: 750 });
      return;
    }

    if (!hasAutoCenteredRef.current && !hasUserInteractedRef.current && !hasSelectedVenue) {
      hasAutoCenteredRef.current = true;
      onAwayChangeRef.current(false);
      map.flyTo({ center: [userLng, userLat], zoom: 13.5, duration: 750 });
    }
  }, [hasSelectedVenue, map, recenterSignal, userLat, userLng]);

  return null;
}

interface MarkerEntry {
  venue: VenueListItem & { lat: number; lng: number };
  container: HTMLDivElement;
}

/** Quản lý marker icon đại diện và React Portal popup trên MapLibre GL. */
function VenueMarkersLayer({
  venues,
  selectedVenueId,
  onSelectVenue,
}: {
  venues: VenueListItem[];
  selectedVenueId?: string;
  onSelectVenue?: (venue: VenueListItem) => void;
}) {
  const map = useMapLibre();
  const onSelectVenueRef = React.useRef(onSelectVenue);
  React.useEffect(() => {
    onSelectVenueRef.current = onSelectVenue;
  }, [onSelectVenue]);

  const [markerEntries, setMarkerEntries] = React.useState<MarkerEntry[]>([]);
  const [popupVenue, setPopupVenue] = React.useState<VenueListItem | null>(null);
  const popupRef = React.useRef<Popup | null>(null);
  const popupContainer = React.useMemo(
    () => (typeof document !== 'undefined' ? document.createElement('div') : null),
    [],
  );

  React.useEffect(() => {
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!map) {
      setMarkerEntries([]);
      return undefined;
    }

    const createdMarkers: Marker[] = [];
    const nextEntries: MarkerEntry[] = [];

    for (const venue of venues) {
      if (!isValidCoordinate(venue)) continue;

      // Container gốc rỗng (không CSS transition) để MapLibre bám toạ độ 60fps
      const container = document.createElement('div');
      container.style.zIndex = '1';

      const marker = new Marker({ element: container, anchor: 'bottom' })
        .setLngLat([venue.lng, venue.lat])
        .addTo(map);

      createdMarkers.push(marker);
      nextEntries.push({ venue, container });
    }

    setMarkerEntries(nextEntries);

    return () => {
      for (const marker of createdMarkers) {
        marker.remove();
      }
      setMarkerEntries([]);
    };
  }, [map, venues]);

  // Chỉ cập nhật thứ tự xếp lớp khi đổi sân được chọn, KHÔNG gỡ/tạo lại Marker
  React.useEffect(() => {
    for (const entry of markerEntries) {
      entry.container.style.zIndex = entry.venue.id === selectedVenueId ? '20' : '1';
    }
  }, [markerEntries, selectedVenueId]);

  const handleSelectPin = React.useCallback(
    (venue: VenueListItem & { lat: number; lng: number }) => {
      onSelectVenueRef.current?.(venue);
      setPopupVenue(venue);

      if (!map || !popupContainer) return;

      popupRef.current?.remove();
      const popup = new Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '280px',
        offset: 34,
        className: 'bsc-custom-popup',
      })
        .setLngLat([venue.lng, venue.lat])
        .setDOMContent(popupContainer)
        .addTo(map);

      popup.on('close', () => {
        setPopupVenue((current) => (current?.id === venue.id ? null : current));
      });

      popupRef.current = popup;
    },
    [map, popupContainer],
  );

  return (
    <>
      {markerEntries.map((entry) =>
        createPortal(
          <VenueMarkerPin
            venue={entry.venue}
            isSelected={entry.venue.id === selectedVenueId}
            onSelect={() => handleSelectPin(entry.venue)}
          />,
          entry.container,
          entry.venue.id,
        ),
      )}

      {popupContainer &&
        popupVenue &&
        createPortal(
          <div className="flex w-[240px] flex-col gap-2 p-1 text-neutral-900">
            {/* Ảnh thu nhỏ */}
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-neutral-100">
              {popupVenue.coverUrl ? (
                <Image
                  src={popupVenue.coverUrl}
                  alt={popupVenue.name}
                  fill
                  unoptimized={popupVenue.coverUrl.startsWith('data:')}
                  sizes="240px"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-neutral-400">
                  <ImageOff className="size-6" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Thông tin cơ sở */}
            <div className="flex flex-col gap-1">
              <h4 className="line-clamp-1 text-sm font-bold text-neutral-900" title={popupVenue.name}>
                {popupVenue.name}
              </h4>

              <p className="flex items-center gap-1 text-xs text-neutral-600">
                <MapPin className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                <span className="line-clamp-1">
                  {popupVenue.district?.name ?? popupVenue.province?.name ?? popupVenue.address}
                </span>
              </p>

              <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-primary-700">
                  từ {popupVenue.fromPrice === null ? 'liên hệ' : formatCurrency(popupVenue.fromPrice)}
                </span>

                {popupVenue.reviewCount > 0 ? (
                  <span className="flex items-center gap-0.5 text-neutral-700">
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                    <span className="font-medium">{popupVenue.ratingAvg.toFixed(1)}</span>
                    <span className="text-[10px] text-neutral-400">
                      ({formatNumber(popupVenue.reviewCount)})
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400">Chưa có đánh giá</span>
                )}
              </div>
            </div>

            {/* Nút xem chi tiết & đặt sân */}
            <Link
              href={`/venues/${popupVenue.slug}`}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'sm' }),
                'mt-1 w-full gap-1 text-xs font-medium',
              )}
            >
              <span>Xem chi tiết & đặt</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </div>,
          popupContainer,
        )}
    </>
  );
}

export interface VenueMapProps {
  venues: VenueListItem[];
  selectedVenueId?: string;
  onSelectVenue?: (venue: VenueListItem) => void;
  className?: string;
}

export function VenueMap({
  venues,
  selectedVenueId,
  onSelectVenue,
  className,
}: VenueMapProps) {
  // Toạ độ mặc định TP. Hồ Chí Minh [lng, lat] cho MapLibre
  const defaultCenter: [number, number] = [106.700806, 10.776889];
  const initialCenter: [number, number] =
    venues[0] && isValidCoordinate(venues[0]) ? [venues[0].lng, venues[0].lat] : defaultCenter;

  const selectedVenue = React.useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  const [userLocation, setUserLocation] = React.useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [isAwayFromUser, setIsAwayFromUser] = React.useState(false);
  const [recenterSignal, setRecenterSignal] = React.useState(0);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);

  const requestUserLocation = React.useCallback((options?: { manual?: boolean }) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      if (options?.manual) {
        setLocationNotice('Trình duyệt hiện chưa hỗ trợ định vị GPS.');
      }
      return;
    }

    setIsLocating(true);
    if (options?.manual) {
      setLocationNotice(null);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        setIsLocating(false);

        if (!isWithinVietnamRegion(coords)) {
          if (options?.manual) {
            setLocationNotice('Vị trí hiện tại đang nằm ngoài phạm vi bản đồ Việt Nam.');
          }
          return;
        }

        setUserLocation(coords);
        setIsAwayFromUser(false);
        setLocationNotice(null);
        if (options?.manual) {
          setRecenterSignal((prev) => prev + 1);
        }
      },
      () => {
        setIsLocating(false);
        if (options?.manual) {
          setLocationNotice('Không thể truy cập vị trí. Hãy cấp quyền định vị cho trình duyệt.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  // Làm nóng sẵn tile z12/z14 cho các sân đang hiển thị để giảm thiểu ô trắng khi chọn hoặc chuyển giữa các sân
  React.useEffect(() => {
    const pmtilesUrl = getActivePmTilesUrl();
    if (!pmtilesUrl) return undefined;

    const coords = venues
      .filter(isValidCoordinate)
      .slice(0, 8)
      .map((venue) => [venue.lng, venue.lat] as [number, number]);

    if (coords.length === 0) return undefined;

    const timer = setTimeout(() => {
      void prewarmPmTilesForCoordinates(pmtilesUrl, coords, {
        zooms: [12, 14],
        radius: 1,
        maxCenters: 6,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [venues]);

  // Tự động định vị vị trí người dùng ngay khi mở bản đồ tìm sân
  React.useEffect(() => {
    requestUserLocation({ manual: false });
  }, [requestUserLocation]);

  // Tự ẩn thông báo lỗi định vị sau 3.5 giây nếu có
  React.useEffect(() => {
    if (!locationNotice) return undefined;
    const timer = setTimeout(() => setLocationNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [locationNotice]);

  const handleRecenterClick = () => {
    if (userLocation) {
      setRecenterSignal((prev) => prev + 1);
      setIsAwayFromUser(false);
      return;
    }
    requestUserLocation({ manual: true });
  };

  return (
    <TileResilienceProvider>
      <div
        className={cn(
          'relative isolate z-0 size-full overflow-hidden rounded-card border border-neutral-200 bg-neutral-50',
          className,
        )}
      >
        <MapLibreCanvas
          center={initialCenter}
          zoom={13}
          maxZoom={19}
          scrollWheelZoom
          className="size-full"
          style={{ minHeight: '100%', width: '100%' }}
        >
          <ResilientTileLayer />
          <VietnamMaritimeLayer />
          <MapBoundsUpdater
            venues={venues}
            selectedVenue={selectedVenue}
            hasUserLocation={userLocation !== null}
          />
          <UserLocationLayer
            userLocation={userLocation}
            recenterSignal={recenterSignal}
            hasSelectedVenue={selectedVenue !== null}
            onAwayChange={setIsAwayFromUser}
          />
          <VenueMarkersLayer
            venues={venues}
            selectedVenueId={selectedVenueId}
            onSelectVenue={onSelectVenue}
          />
        </MapLibreCanvas>

        {/* Nút định vị quay về vị trí hiện tại của người dùng */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleRecenterClick();
            }}
            disabled={isLocating}
            aria-label="Về vị trí hiện tại của tôi"
            title="Về vị trí hiện tại của tôi"
            className={cn(
              'flex size-9 items-center justify-center rounded-btn border shadow-md backdrop-blur-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60',
              userLocation && !isAwayFromUser
                ? 'border-primary-300 bg-primary-50/95 text-primary-700 hover:bg-primary-100'
                : 'border-border bg-bg-card/95 text-text-primary hover:border-primary-400 hover:bg-bg-subtle hover:text-primary-700',
            )}
          >
            {isLocating ? (
              <Loader2 className="size-4 animate-spin text-primary-600" aria-hidden="true" />
            ) : (
              <LocateFixed className="size-4" aria-hidden="true" />
            )}
          </button>

          {locationNotice && (
            <div
              role="status"
              aria-live="polite"
              className="max-w-[240px] rounded-md border border-border bg-bg-card/95 px-2.5 py-1.5 text-xs text-text-primary shadow-md backdrop-blur-xs"
            >
              {locationNotice}
            </div>
          )}
        </div>

        <MapResilienceControl />
      </div>
    </TileResilienceProvider>
  );
}
