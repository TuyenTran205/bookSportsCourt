'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LockKeyhole,
  Minus,
  Plus,
  UnlockKeyhole,
  UserRound,
} from 'lucide-react';

import type { Blackout, OwnerTimelineBooking, Slot } from '@bsc/shared';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { TimeSelect } from '@/components/ui/time-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  createBlackout,
  createManualBooking,
  deleteBlackout,
  getOwnerTimeline,
  listOwnerVenues,
} from '@/lib/api/endpoints/owner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOwnerRealtime } from '@/lib/hooks/useOwnerRealtime';
import { useOptionalSocket } from '@/lib/hooks/useSocket';
import { formatCurrency, formatTimeRange } from '@/lib/utils/format';

type TimelineSlot = Pick<Slot, 'start' | 'end'> & { time: string; endTime: string };
type SlotState = 'available' | 'booked' | 'blocked' | 'closed' | 'past';
type PointerRange = { courtId: string; startIndex: number; endIndex: number };
type ManualDraft = { courtId: string; date: string; startTime: string; endTime: string };
type BlackoutDraft = ManualDraft & { reason: string };

const SLOT_MINUTES = 30;
const DEFAULT_SLOT_WIDTH = 68;
const DEFAULT_LABEL_WIDTH = 148;
const MOBILE_SLOT_WIDTH = 44;
const MOBILE_LABEL_WIDTH = 138;
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const EMPTY_BOOKINGS: OwnerTimelineBooking[] = [];
const EMPTY_BLACKOUTS: Blackout[] = [];

function vietnamToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, amount: number): string {
  const shifted = new Date(`${date}T12:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function formatReviewDate(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatDateInputLabel(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function timeInVietnam(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return hour && minute ? `${hour}:${minute}` : '00:00';
}

function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function dateTimeInVietnam(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

function makeTimelineSlots(startMinute: number, endMinute: number, date: string): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  for (let minute = startMinute; minute + SLOT_MINUTES <= endMinute; minute += SLOT_MINUTES) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const endMinuteForSlot = minute + SLOT_MINUTES;
    const endTime = `${String(Math.floor(endMinuteForSlot / 60)).padStart(2, '0')}:${String(endMinuteForSlot % 60).padStart(2, '0')}`;
    slots.push({
      time,
      endTime,
      start: dateTimeInVietnam(date, time),
      end: dateTimeInVietnam(date, endTime),
    });
  }
  return slots;
}

function dateTimeLabel(date: string, start: string, end: string): string {
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00.000Z`));
  return `${dateLabel} ${start} – ${end}`;
}


export function OwnerTimeline() {
  const t = useTranslations('owner');
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = React.useState(vietnamToday);
  const [selectedVenueId, setSelectedVenueId] = React.useState('');

  useOwnerRealtime({ venueId: selectedVenueId });

  const socket = useOptionalSocket();
  const joinVenue = socket?.joinVenue;
  const leaveVenue = socket?.leaveVenue;
  React.useEffect(() => {
    if (!joinVenue || !leaveVenue || !selectedVenueId || !selectedDate) return;
    joinVenue(selectedVenueId, selectedDate);
    return () => leaveVenue(selectedVenueId, selectedDate);
  }, [joinVenue, leaveVenue, selectedVenueId, selectedDate]);
  const [selectedBooking, setSelectedBooking] = React.useState<OwnerTimelineBooking | null>(null);
  const [selectedBlackout, setSelectedBlackout] = React.useState<Blackout | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = React.useState(false);
  const [blackoutDialogOpen, setBlackoutDialogOpen] = React.useState(false);
  const [unlockTarget, setUnlockTarget] = React.useState<Blackout | null>(null);
  const [manualDraft, setManualDraft] = React.useState<ManualDraft>({
    courtId: '',
    date: selectedDate,
    startTime: '08:00',
    endTime: '08:30',
  });
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [bookingNote, setBookingNote] = React.useState('');
  const [blackoutDraft, setBlackoutDraft] = React.useState<BlackoutDraft>({
    courtId: '',
    date: selectedDate,
    startTime: '08:00',
    endTime: '08:30',
    reason: '',
  });
  const [pointerRange, setPointerRange] = React.useState<PointerRange | null>(null);
  const pointerRangeRef = React.useRef<PointerRange | null>(null);
  const pointerActionRef = React.useRef(false);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pointerClientXRef = React.useRef<number | null>(null);

  const [slotWidth, setSlotWidth] = React.useState<number>(DEFAULT_SLOT_WIDTH);
  const [labelWidth, setLabelWidth] = React.useState<number>(DEFAULT_LABEL_WIDTH);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const updateMobile = () => {
      const mob = window.innerWidth < 640;
      setIsMobile(mob);
      setSlotWidth((prev) => (prev === DEFAULT_SLOT_WIDTH || prev === MOBILE_SLOT_WIDTH ? (mob ? MOBILE_SLOT_WIDTH : DEFAULT_SLOT_WIDTH) : prev));
      setLabelWidth(mob ? MOBILE_LABEL_WIDTH : DEFAULT_LABEL_WIDTH);
    };
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!selectedVenueId && venuesQuery.data?.length) {
      setSelectedVenueId(venuesQuery.data[0]!.id);
    }
  }, [selectedVenueId, venuesQuery.data]);

  const timelineQuery = useQuery({
    queryKey: ['owner', 'timeline', selectedVenueId, selectedDate],
    queryFn: () => getOwnerTimeline(selectedVenueId, selectedDate),
    enabled: Boolean(selectedVenueId),
    staleTime: 30_000,
  });

  const timeline = timelineQuery.data;
  const courts = timeline?.courts ?? [];
  const bookings = timeline?.bookings ?? EMPTY_BOOKINGS;
  const blackouts = timeline?.blackouts ?? EMPTY_BLACKOUTS;
  const weekday = weekdayOf(selectedDate);

  const hoursForCourt = React.useCallback((courtId: string) => {
    const hours = timeline?.openingHours.filter((item) => item.weekday === weekday) ?? [];
    const courtHours = hours.filter((item) => item.courtId === courtId);
    const openingHour = courtHours[0] ?? hours.find((item) => item.courtId === null);
    if (!openingHour || openingHour.isClosed) return null;
    return {
      start: minutesOfDay(openingHour.openTime),
      end: minutesOfDay(openingHour.closeTime),
    };
  }, [timeline?.openingHours, weekday]);

  const visibleHours = courts
    .map((court) => hoursForCourt(court.id))
    .filter((range): range is { start: number; end: number } => Boolean(range));
  const earliestMinute = visibleHours.length
    ? Math.min(...visibleHours.map((range) => range.start))
    : 0;
  const latestMinute = visibleHours.length
    ? Math.max(...visibleHours.map((range) => range.end))
    : 0;
  const slots = makeTimelineSlots(earliestMinute, latestMinute, selectedDate);
  const isCompactView = isMobile && slotWidth < 28;
  const activeLabelWidth = isCompactView ? 52 : labelWidth;
  const columns = `minmax(${activeLabelWidth}px, ${activeLabelWidth}px) repeat(${slots.length}, ${slotWidth}px)`;

  const slotState = React.useCallback((courtId: string, slot: TimelineSlot): SlotState => {
    const start = new Date(slot.start).getTime();
    const end = new Date(slot.end).getTime();
    const opening = hoursForCourt(courtId);
    if (!opening || minutesOfDay(slot.time) < opening.start || minutesOfDay(slot.endTime) > opening.end) {
      return 'closed';
    }
    if (blackouts.some((item) => item.courtId === courtId
      && new Date(item.start).getTime() < end
      && new Date(item.end).getTime() > start)) {
      return 'blocked';
    }
    if (bookings.some((item) => item.courtId === courtId
      && new Date(item.during.start).getTime() < end
      && new Date(item.during.end).getTime() > start)) {
      return 'booked';
    }
    if (start < Date.now()) return 'past';
    return 'available';
  }, [bookings, blackouts, hoursForCourt]);

  const clearSelection = React.useCallback(() => {
    setSelectedBooking(null);
    setSelectedBlackout(null);
  }, []);

  const openManualBooking = React.useCallback((courtId: string, selectedSlots: TimelineSlot[]) => {
    if (selectedSlots.length === 0) return;
    setManualDraft({
      courtId,
      date: selectedDate,
      startTime: selectedSlots[0]!.time,
      endTime: selectedSlots[selectedSlots.length - 1]!.endTime,
    });
    setGuestName('');
    setGuestPhone('');
    setBookingNote('');
    clearSelection();
    setManualDialogOpen(true);
  }, [clearSelection, selectedDate]);

  const setPointerSelection = React.useCallback((range: PointerRange | null) => {
    pointerRangeRef.current = range;
    setPointerRange(range);
  }, []);

  const extendPointerSelection = React.useCallback(
    (targetIndex: number) => {
      const range = pointerRangeRef.current;
      if (!range || slots.length === 0) return;
      const clampedTarget = Math.max(0, Math.min(slots.length - 1, targetIndex));
      const direction = clampedTarget >= range.startIndex ? 1 : -1;
      let validEndIndex = range.startIndex;
      for (
        let i = range.startIndex;
        direction > 0 ? i <= clampedTarget : i >= clampedTarget;
        i += direction
      ) {
        if (slotState(range.courtId, slots[i]!) !== 'available') break;
        validEndIndex = i;
      }
      if (validEndIndex !== range.endIndex) {
        setPointerSelection({ ...range, endIndex: validEndIndex });
      }
    },
    [setPointerSelection, slotState, slots],
  );

  const slotIndexFromClientX = React.useCallback(
    (clientX: number): number | null => {
      const container = scrollContainerRef.current;
      if (!container || slots.length === 0) return null;
      const rect = container.getBoundingClientRect();
      const clampedClientX = Math.max(rect.left + activeLabelWidth, Math.min(rect.right - 2, clientX));
      const offsetInStrip = clampedClientX - rect.left + container.scrollLeft - activeLabelWidth;
      return Math.floor(offsetInStrip / slotWidth);
    },
    [activeLabelWidth, slotWidth, slots.length],
  );

  const isPointerSelecting = pointerRange !== null;

  React.useEffect(() => {
    if (!isPointerSelecting) return;

    const handlePointerMove = (event: PointerEvent) => {
      pointerClientXRef.current = event.clientX;
      const nextIndex = slotIndexFromClientX(event.clientX);
      if (nextIndex !== null) {
        extendPointerSelection(nextIndex);
      }
    };

    let rafId = 0;
    const EDGE_ZONE = 64;
    const tickAutoScroll = () => {
      const container = scrollContainerRef.current;
      const clientX = pointerClientXRef.current;
      if (container && clientX !== null && pointerRangeRef.current) {
        const rect = container.getBoundingClientRect();
        const rightDistance = rect.right - clientX;
        const leftDistance = clientX - (rect.left + activeLabelWidth);
        let delta = 0;
        if (
          rightDistance < EDGE_ZONE &&
          container.scrollLeft + container.clientWidth < container.scrollWidth - 1
        ) {
          const intensity = Math.min(2.5, Math.max(0.2, (EDGE_ZONE - rightDistance) / EDGE_ZONE));
          delta = Math.ceil(intensity * 14);
        } else if (leftDistance < EDGE_ZONE && container.scrollLeft > 0) {
          const intensity = Math.min(2.5, Math.max(0.2, (EDGE_ZONE - leftDistance) / EDGE_ZONE));
          delta = -Math.ceil(intensity * 14);
        }
        if (delta !== 0) {
          container.scrollLeft += delta;
          const nextIndex = slotIndexFromClientX(clientX);
          if (nextIndex !== null) {
            extendPointerSelection(nextIndex);
          }
        }
      }
      if (pointerRangeRef.current) {
        rafId = window.requestAnimationFrame(tickAutoScroll);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    rafId = window.requestAnimationFrame(tickAutoScroll);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.cancelAnimationFrame(rafId);
    };
  }, [extendPointerSelection, isPointerSelecting, slotIndexFromClientX]);

  React.useEffect(() => {
    const finishPointerSelection = () => {
      pointerClientXRef.current = null;
      const range = pointerRangeRef.current;
      if (!range) return;
      const selectedSlots = slots.slice(
        Math.min(range.startIndex, range.endIndex),
        Math.max(range.startIndex, range.endIndex) + 1,
      );
      setPointerSelection(null);
      openManualBooking(range.courtId, selectedSlots);
    };
    window.addEventListener('pointerup', finishPointerSelection);
    window.addEventListener('pointercancel', finishPointerSelection);
    return () => {
      window.removeEventListener('pointerup', finishPointerSelection);
      window.removeEventListener('pointercancel', finishPointerSelection);
    };
  }, [openManualBooking, setPointerSelection, slots]);

  const createBookingMutation = useMutation({
    mutationFn: () => {
      const start = minutesOfDay(manualDraft.startTime);
      const end = minutesOfDay(manualDraft.endTime);
      const manualSlots = [];
      for (let minute = start; minute < end; minute += SLOT_MINUTES) {
        manualSlots.push({
          start: dateTimeInVietnam(manualDraft.date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`),
          end: dateTimeInVietnam(manualDraft.date, `${String(Math.floor((minute + SLOT_MINUTES) / 60)).padStart(2, '0')}:${String((minute + SLOT_MINUTES) % 60).padStart(2, '0')}`),
        });
      }
      return createManualBooking({
        courtId: manualDraft.courtId,
        slots: manualSlots,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        note: bookingNote.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'timeline', selectedVenueId, selectedDate] });
      await queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
      setManualDialogOpen(false);
      toast.success(t('manualBookingSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('manualBookingFailed'));
    },
  });

  const createBlackoutMutation = useMutation({
    mutationFn: () => createBlackout(blackoutDraft.courtId, {
      start: dateTimeInVietnam(blackoutDraft.date, blackoutDraft.startTime),
      end: dateTimeInVietnam(blackoutDraft.date, blackoutDraft.endTime),
      reason: blackoutDraft.reason.trim() || undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'timeline', selectedVenueId, selectedDate] });
      setBlackoutDialogOpen(false);
      setSelectedBlackout(null);
      toast.success(t('blackoutSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('blackoutFailed'));
    },
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: (blackout: Blackout) => deleteBlackout(blackout.courtId, blackout.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'timeline', selectedVenueId, selectedDate] });
      setUnlockTarget(null);
      setSelectedBlackout(null);
      toast.success(t('unlockSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('unlockFailed'));
    },
  });

  const selectDate = (date: string) => {
    setSelectedDate(date);
    clearSelection();
    setPointerSelection(null);
  };

  const openBlackoutDialog = () => {
    const initialCourt = courts[0];
    const opening = initialCourt ? hoursForCourt(initialCourt.id) : null;
    const startTime = opening
      ? `${String(Math.floor(opening.start / 60)).padStart(2, '0')}:${String(opening.start % 60).padStart(2, '0')}`
      : '08:00';
    const endMinute = opening ? Math.min(opening.start + SLOT_MINUTES, opening.end) : 510;
    const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
    setBlackoutDraft({
      courtId: initialCourt?.id ?? '',
      date: selectedDate,
      startTime,
      endTime,
      reason: '',
    });
    clearSelection();
    setBlackoutDialogOpen(true);
  };

  if (role !== 'owner') return null;

  if (venuesQuery.isLoading) {
    return (
      <div className="space-y-5" aria-label={t('timelineLoading')}>
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (venuesQuery.isError) {
    return <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />;
  }

  if (!venuesQuery.data?.length) {
    return (
      <div className="rounded-card border border-dashed border-border bg-bg-card p-8 text-center">
        <CalendarDays className="mx-auto mb-3 size-8 text-neutral-400" aria-hidden="true" />
        <h2 className="font-semibold text-neutral-900">{t('timelineNoVenue')}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t('timelineNoVenueDesc')}</p>
        <Button asChild className="mt-4">
          <Link href="/owner/venues">{t('manageCourts')}</Link>
        </Button>
      </div>
    );
  }

  if (selectedVenueId && timelineQuery.isError) {
    return <ErrorState error={timelineQuery.error} onRetry={() => void timelineQuery.refetch()} />;
  }

  const detailCourt = selectedBooking
    ? courts.find((court) => court.id === selectedBooking.courtId)
    : selectedBlackout
      ? courts.find((court) => court.id === selectedBlackout.courtId)
      : undefined;
  const detailRange = selectedBooking?.during
    ?? (selectedBlackout ? { start: selectedBlackout.start, end: selectedBlackout.end } : null);
  const detailStart = detailRange ? timeInVietnam(detailRange.start) : '';
  const detailEnd = detailRange ? timeInVietnam(detailRange.end) : '';
  const hoursLabel = t('timelineDateLabel', { date: formatReviewDate(selectedDate) });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{t('timelineTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t('timelineHint')}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="timeline-venue" className="shrink-0 text-sm font-medium text-neutral-700 sr-only sm:not-sr-only">
              {t('selectVenue')}
            </label>
            <select
              id="timeline-venue"
              value={selectedVenueId}
              onChange={(event) => {
                setSelectedVenueId(event.target.value);
                clearSelection();
                setPointerSelection(null);
              }}
              className="h-10 w-full sm:w-auto min-w-44 rounded-input border border-border bg-bg-card px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              {venuesQuery.data.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 flex-1 min-w-[190px]">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('prevDay')}
                onClick={() => selectDate(shiftDate(selectedDate, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <div className="relative flex h-10 flex-1 sm:w-40 items-center justify-center gap-2 rounded-input border border-border bg-bg-card px-2.5 sm:px-3 text-sm text-text-primary focus-within:border-primary-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-600/20">
                <CalendarDays className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <label className="sr-only" htmlFor="timeline-date">{t('selectDate')}</label>
                <span aria-hidden="true" className="pointer-events-none tabular-nums text-xs sm:text-sm font-medium">{formatDateInputLabel(selectedDate)}</span>
                <Input
                  id="timeline-date"
                  aria-label={t('selectDate')}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    if (event.target.value) selectDate(event.target.value);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('nextDay')}
                onClick={() => selectDate(shiftDate(selectedDate, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-2.5 sm:px-3 text-xs sm:text-sm"
                onClick={() => selectDate(vietnamToday())}
                disabled={selectedDate === vietnamToday()}
              >
                {t('today')}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-2.5 sm:px-3 text-xs sm:text-sm"
                onClick={openBlackoutDialog}
                disabled={!courts.length}
              >
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                <span>{t('blackout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-neutral-700">{hoursLabel}</p>
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto rounded-md border border-neutral-200 bg-neutral-50 p-1 text-xs">
          <span className="text-[11px] font-medium text-neutral-500 hidden xs:inline">Thu phóng:</span>
          
          <button
            type="button"
            onClick={() => {
              const container = scrollContainerRef.current;
              if (!container || slots.length === 0) return;
              const isMob = window.innerWidth < 640;
              const targetLabelW = isMob ? 52 : 80;
              const available = container.clientWidth - targetLabelW - 4;
              const fitted = Math.max(8, Math.min(DEFAULT_SLOT_WIDTH, Math.floor(available / slots.length)));
              setSlotWidth(fitted);
            }}
            className="rounded px-2 py-0.5 font-medium text-[11px] bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
            title="Thu nhỏ để nhìn thấy toàn bộ các block trên màn hình"
          >
            Vừa màn
          </button>

          <button
            type="button"
            onClick={() => setSlotWidth(isMobile ? MOBILE_SLOT_WIDTH : DEFAULT_SLOT_WIDTH)}
            className="rounded px-2 py-0.5 font-medium text-[11px] bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
            title="Kích thước mặc định"
          >
            Chuẩn
          </button>

          <div className="flex items-center gap-0.5 ml-0.5">
            <button
              type="button"
              onClick={() => setSlotWidth((w) => Math.max(8, w - 6))}
              disabled={slotWidth <= 8}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Thu nhỏ block"
              title="Thu nhỏ block"
            >
              <Minus className="size-3" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={8}
              max={96}
              step={2}
              value={slotWidth}
              onChange={(e) => setSlotWidth(Number(e.target.value))}
              className="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-600 sm:w-28"
              aria-label="Thanh thu phóng kích thước block"
            />
            <button
              type="button"
              onClick={() => setSlotWidth((w) => Math.min(96, w + 6))}
              disabled={slotWidth >= 96}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Phóng to block"
              title="Phóng to block"
            >
              <Plus className="size-3" aria-hidden="true" />
            </button>
          </div>

          <span className="font-mono text-[10px] tabular-nums text-neutral-500 min-w-8 text-right">
            {Math.round((slotWidth / (isMobile ? MOBILE_SLOT_WIDTH : DEFAULT_SLOT_WIDTH)) * 100)}%
          </span>
        </div>
      </div>

      {timelineQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]" aria-label={t('timelineLoading')}>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : courts.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-bg-card p-8 text-center">
          <CalendarDays className="mx-auto mb-3 size-8 text-neutral-400" aria-hidden="true" />
          <h2 className="font-semibold text-neutral-900">{t('timelineNoCourts')}</h2>
          <p className="mt-1 text-sm text-neutral-600">{t('timelineNoCourtsDesc')}</p>
          <Button asChild className="mt-4">
            <Link href="/owner/venues">{t('addCourt')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <section className="min-w-0 overflow-hidden rounded-card border border-border bg-bg-card">
            {slots.length === 0 ? (
              <div className="p-8 text-center">
                <Clock3 className="mx-auto mb-2 size-7 text-neutral-400" aria-hidden="true" />
                <p className="font-medium text-neutral-900">{t('timelineNoOpeningHours')}</p>
                <p className="mt-1 text-sm text-neutral-600">{t('timelineNoOpeningHoursDesc')}</p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/owner/pricing">{t('pricingTitle')}</Link>
                </Button>
              </div>
            ) : (
              <div ref={scrollContainerRef} className="overflow-x-auto select-none">
                <div className="min-w-max">
                  <div className="grid border-b border-border bg-bg-subtle text-xs text-text-secondary" style={{ gridTemplateColumns: columns }}>
                    <div className="sticky left-0 z-10 flex min-h-10 sm:min-h-11 items-center border-r border-border bg-bg-subtle px-1.5 sm:px-3 text-[11px] sm:text-xs font-medium text-text-primary justify-center sm:justify-start">
                      {isCompactView ? 'Sân' : t('colCourt')}
                    </div>
                    {slots.map((slot, index) => {
                      let hourStep = 1;
                      if (slotWidth < 12) hourStep = 4;
                      else if (slotWidth < 20) hourStep = 3;
                      else if (slotWidth < 34) hourStep = 2;

                      const hourNum = parseInt(slot.time.split(':')[0] ?? '0', 10);
                      const shouldShow = slot.time.endsWith(':00') && (hourNum % hourStep === 0);
                      if (!shouldShow) return null;

                      const spanCount = Math.min(hourStep * 2, slots.length - index);
                      return (
                        <div
                          key={slot.start}
                          className="flex h-10 sm:h-11 items-center justify-center border-r border-border/60 text-[10px] sm:text-xs tabular-nums text-neutral-600 font-medium"
                          style={{ gridColumn: `${index + 2} / span ${spanCount}` }}
                        >
                          {slotWidth < 15 ? slot.time.slice(0, 2) : slot.time}
                        </div>
                      );
                    })}
                  </div>

                  {courts.map((court) => (
                    <div
                      key={court.id}
                      className="grid min-h-[50px] sm:min-h-14 border-b border-border last:border-b-0"
                      style={{ gridTemplateColumns: columns }}
                    >
                      <div
                        className="sticky left-0 z-10 flex items-center border-r border-border bg-bg-card px-1.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-text-primary overflow-hidden justify-center sm:justify-start"
                        title={court.name}
                      >
                        {isCompactView ? (
                          <span className="font-semibold text-[10px] text-center w-full truncate leading-tight">
                            {court.name.replace(/^Sân bóng rổ /i, 'S').replace(/^Sân cầu lông /i, 'S').replace(/^Sân /i, 'S')}
                          </span>
                        ) : (
                          <span className="line-clamp-2 leading-tight break-words">
                            {court.name}
                          </span>
                        )}
                      </div>
                      {slots.map((slot, index) => {
                        const state = slotState(court.id, slot);
                        const booking = bookings.find((item) => item.courtId === court.id
                          && new Date(item.during.start).getTime() < new Date(slot.end).getTime()
                          && new Date(item.during.end).getTime() > new Date(slot.start).getTime());
                        const blackout = blackouts.find((item) => item.courtId === court.id
                          && new Date(item.start).getTime() < new Date(slot.end).getTime()
                          && new Date(item.end).getTime() > new Date(slot.start).getTime());
                        const isSelected = Boolean(pointerRange
                          && pointerRange.courtId === court.id
                          && index >= Math.min(pointerRange.startIndex, pointerRange.endIndex)
                          && index <= Math.max(pointerRange.startIndex, pointerRange.endIndex));
                        const classes = {
                          available: 'bg-bg-card hover:bg-bg-subtle focus-visible:bg-bg-subtle',
                          booked: 'bg-primary-700 text-white hover:bg-primary-800',
                          blocked: 'bg-[repeating-linear-gradient(135deg,var(--color-neutral-200)_0,var(--color-neutral-200)_4px,var(--color-neutral-50)_4px,var(--color-neutral-50)_8px)] text-neutral-700 hover:brightness-95',
                          closed: 'bg-neutral-100 text-neutral-400',
                          past: 'bg-neutral-50 text-neutral-400',
                        } satisfies Record<SlotState, string>;
                        const label = state === 'booked'
                          ? (booking?.customerName ?? booking?.guestName ?? t('guestName'))
                          : state === 'blocked'
                            ? t('blackoutBadge')
                            : '';
                        const accessibleLabel = `${court.name}, ${slot.time}–${slot.endTime}, ${t(`timelineSlot${state[0]!.toUpperCase()}${state.slice(1)}`)}${label ? `, ${label}` : ''}`;

                        return (
                          <button
                            key={slot.start}
                            type="button"
                            aria-label={accessibleLabel}
                            title={state === 'booked' ? label : state === 'blocked' ? blackout?.reason ?? t('blackoutBadge') : undefined}
                            disabled={state === 'closed' || state === 'past'}
                            onPointerDown={(event) => {
                              if (state !== 'available') return;
                              event.preventDefault();
                              pointerActionRef.current = true;
                              pointerClientXRef.current = event.clientX;
                              setPointerSelection({ courtId: court.id, startIndex: index, endIndex: index });
                            }}
                            onPointerEnter={() => {
                              const range = pointerRangeRef.current;
                              if (!range || range.courtId !== court.id) return;
                              extendPointerSelection(index);
                            }}
                            onPointerUp={() => {
                              if (state === 'booked' && booking) {
                                clearSelection();
                                setSelectedBooking(booking);
                              } else if (state === 'blocked' && blackout) {
                                clearSelection();
                                setSelectedBlackout(blackout);
                              }
                            }}
                            onClick={() => {
                              if (pointerActionRef.current) {
                                pointerActionRef.current = false;
                                return;
                              }
                              if (state === 'available') openManualBooking(court.id, [slot]);
                              if (state === 'booked' && booking) {
                                clearSelection();
                                setSelectedBooking(booking);
                              }
                              if (state === 'blocked' && blackout) {
                                clearSelection();
                                setSelectedBlackout(blackout);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && state === 'available') {
                                event.preventDefault();
                                openManualBooking(court.id, [slot]);
                              }
                            }}
                            data-slot-cell="true"
                            className={`relative flex min-h-[50px] sm:min-h-14 min-w-0 items-center justify-center border-r border-neutral-200 px-0.5 sm:px-1 text-center text-[9px] sm:text-[10px] leading-tight transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700 disabled:cursor-not-allowed ${classes[state]} ${isSelected ? 'ring-2 ring-inset ring-primary-700' : ''}`}
                            style={{ gridColumn: index + 2, touchAction: 'none' }}
                          >
                            {state === 'booked' && booking && booking.during.start === slot.start && slotWidth >= 26
                              ? (
                                <span className="truncate max-w-full px-0.5 font-semibold">
                                  {isMobile ? `${Math.round(booking.totalPrice / 1000)}k` : formatCurrency(booking.totalPrice)}
                                </span>
                              )
                              : state === 'blocked' && slotWidth >= 18
                                ? <LockKeyhole className="size-3 sm:size-3.5" aria-hidden="true" />
                                : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="min-h-48 rounded-card border border-border bg-bg-card p-4" aria-live="polite">
            {selectedBooking ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-text-primary">{t('timelineBookingDetail')}</h2>
                  <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                    {t('close')}
                  </Button>
                </div>
                <dl className="space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="whitespace-nowrap text-text-secondary">{t('timelineCustomerLabel')}</dt>
                    <dd className="text-right font-medium text-text-primary">
                      {selectedBooking.customerName ?? selectedBooking.guestName ?? t('guestName')}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="whitespace-nowrap text-text-secondary">{t('timelineCourtLabel')}</dt>
                    <dd className="text-right font-medium text-text-primary">{detailCourt?.name ?? '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="whitespace-nowrap text-text-secondary">{t('time')}</dt>
                    <dd className="text-right tabular-nums text-text-primary">
                      {detailRange ? `${timeInVietnam(detailRange.start)} – ${timeInVietnam(detailRange.end)}` : '—'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="whitespace-nowrap text-text-secondary">{t('source')}</dt>
                    <dd className="text-right text-text-primary">
                      {selectedBooking.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="whitespace-nowrap text-text-secondary">{t('totalAmount')}</dt>
                    <dd className="text-right font-semibold tabular-nums text-text-primary">
                      {formatCurrency(selectedBooking.totalPrice)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <dt className="shrink-0 whitespace-nowrap text-text-secondary">{t('status')}</dt>
                    <dd className="flex min-w-0 flex-1 justify-end">
                      <StatusBadge
                        kind="booking"
                        status={selectedBooking.status}
                        size="sm"
                        className="max-w-full whitespace-normal break-words text-right leading-snug"
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : selectedBlackout ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-neutral-900">{t('blackoutDetail')}</h2>
                  <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                    {t('close')}
                  </Button>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">{t('blackoutCourt')}</dt>
                    <dd className="text-right font-medium text-neutral-900">{detailCourt?.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">{t('time')}</dt>
                    <dd className="text-right tabular-nums text-neutral-900">
                      {detailRange ? `${timeInVietnam(detailRange.start)} – ${timeInVietnam(detailRange.end)}` : '—'}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-neutral-500">{t('blackoutReasonLabel')}</dt>
                    <dd className="text-neutral-900">{selectedBlackout.reason || t('noData')}</dd>
                  </div>
                </dl>
                <Button type="button" variant="outline" className="w-full" onClick={() => setUnlockTarget(selectedBlackout)}>
                  <UnlockKeyhole aria-hidden="true" />
                  {t('unlockCourt')}
                </Button>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center text-center">
                <UserRound className="mb-2 size-5 text-neutral-400" aria-hidden="true" />
                <h2 className="text-sm font-medium text-neutral-900">{t('timelineDetailTitle')}</h2>
                <p className="mt-1 text-xs leading-5 text-neutral-600">{t('clickBlockHint')}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('manualBookingTitle')}</DialogTitle>
            <DialogDescription>
              {t('timelineBookingOnCourt', {
                court: courts.find((court) => court.id === manualDraft.courtId)?.name ?? '',
              })}
              {' · '}
              {dateTimeLabel(manualDraft.date, manualDraft.startTime, manualDraft.endTime)}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createBookingMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="manual-guest-name" className="text-sm font-medium text-neutral-800">{t('manualGuestName')}</label>
                <Input id="manual-guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="manual-guest-phone" className="text-sm font-medium text-neutral-800">{t('manualGuestPhone')}</label>
                <Input id="manual-guest-phone" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} type="tel" maxLength={20} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="manual-start" className="text-sm font-medium text-neutral-800">{t('blackoutStartTime')}</label>
                <Input
                  id="manual-start"
                  type="text"
                  value={manualDraft.startTime}
                  disabled
                  readOnly
                  className="bg-neutral-100 text-neutral-700 cursor-not-allowed font-mono tabular-nums font-semibold select-none shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="manual-end" className="text-sm font-medium text-neutral-800">{t('blackoutEndTime')}</label>
                <Input
                  id="manual-end"
                  type="text"
                  value={manualDraft.endTime}
                  disabled
                  readOnly
                  className="bg-neutral-100 text-neutral-700 cursor-not-allowed font-mono tabular-nums font-semibold select-none shadow-none"
                />
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              * Khung giờ được cố định tự động theo các block bạn đã kéo chọn trên lịch.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="manual-note" className="text-sm font-medium text-neutral-800">{t('manualNote')}</label>
              <Textarea id="manual-note" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} maxLength={500} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>{t('manualCancel')}</Button>
              <Button
                type="submit"
                loading={createBookingMutation.isPending}
                disabled={
                  guestName.trim().length < 2 ||
                  !guestPhone.trim() ||
                  minutesOfDay(manualDraft.endTime) <= minutesOfDay(manualDraft.startTime)
                }
              >
                {t('manualBookingSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={blackoutDialogOpen} onOpenChange={setBlackoutDialogOpen}>
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('blackoutDialogTitle')}</DialogTitle>
            <DialogDescription>{dateTimeLabel(blackoutDraft.date, blackoutDraft.startTime, blackoutDraft.endTime)}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createBlackoutMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="blackout-court" className="text-sm font-medium text-neutral-800">{t('blackoutCourt')}</label>
              <select
                id="blackout-court"
                value={blackoutDraft.courtId}
                onChange={(event) => setBlackoutDraft((current) => ({ ...current, courtId: event.target.value }))}
                className="h-10 w-full rounded-input border border-border bg-bg-card px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                required
              >
                {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="blackout-start" className="text-sm font-medium text-neutral-800">{t('blackoutStartTime')}</label>
                <TimeSelect
                  id="blackout-start"
                  value={blackoutDraft.startTime}
                  onChange={(e) => setBlackoutDraft((current) => ({ ...current, startTime: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="blackout-end" className="text-sm font-medium text-neutral-800">{t('blackoutEndTime')}</label>
                <TimeSelect
                  id="blackout-end"
                  value={blackoutDraft.endTime}
                  onChange={(e) => setBlackoutDraft((current) => ({ ...current, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="blackout-reason" className="text-sm font-medium text-neutral-800">{t('blackoutReason')}</label>
              <Textarea id="blackout-reason" value={blackoutDraft.reason} onChange={(event) => setBlackoutDraft((current) => ({ ...current, reason: event.target.value }))} placeholder={t('blackoutReasonPlaceholder')} maxLength={200} rows={3} />
            </div>
            {blackouts.length > 0 && (
              <section className="space-y-2 border-t border-neutral-200 pt-4">
                <h3 className="text-sm font-medium text-neutral-900">{t('activeBlackouts')}</h3>
                <ul className="max-h-32 space-y-2 overflow-y-auto">
                  {blackouts.map((blackout) => {
                    const court = courts.find((item) => item.id === blackout.courtId);
                    return (
                      <li key={blackout.id} className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-neutral-700">
                          {court?.name ?? t('blackoutCourt')} · {timeInVietnam(blackout.start)}–{timeInVietnam(blackout.end)}
                        </span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setUnlockTarget(blackout)}>
                          <UnlockKeyhole aria-hidden="true" />
                          {t('unlockCourt')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBlackoutDialogOpen(false)}>{t('manualCancel')}</Button>
              <Button type="submit" loading={createBlackoutMutation.isPending} disabled={!blackoutDraft.courtId || minutesOfDay(blackoutDraft.endTime) <= minutesOfDay(blackoutDraft.startTime)}>
                <LockKeyhole aria-hidden="true" />
                {t('blackoutSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(unlockTarget)} onOpenChange={(open) => { if (!open) setUnlockTarget(null); }}>
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('unlockCourt')}</DialogTitle>
            <DialogDescription>{t('unlockConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnlockTarget(null)}>{t('manualCancel')}</Button>
            <Button
              type="button"
              loading={deleteBlackoutMutation.isPending}
              disabled={!unlockTarget}
              onClick={() => {
                if (unlockTarget) deleteBlackoutMutation.mutate(unlockTarget);
              }}
            >
              <UnlockKeyhole aria-hidden="true" />
              {t('unlockCourt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
