'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAppRouter } from '@/lib/navigation/navigate';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  ClipboardCheck,
  FileText,
  Send,
  MapPin,
  LocateFixed,
  Loader2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ownerApplicationSchema } from '@bsc/shared';
import type { OwnerApplicationInput } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/ErrorState';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/hooks/useAuth';
import { SUPPORTED_BANKS, bankNameFromBin } from '@/lib/utils/payment-qr';
import { useMyOwnerApplication, useSubmitOwnerApplication } from '@/lib/hooks/useOwnerApplication';
import {
  VenueLocationMapWrapper,
  type MapCoordinates,
} from '@/components/features/venue/VenueLocationMapWrapper';
import { geocodeAddress, reverseGeocode, extractAddressAndNote } from '@/lib/utils/geocoding';

function ApplicationLoading() {
  const t = useTranslations('ownerApplication');

  return (
    <div role="status" aria-label={t('loading')} className="mx-auto w-full max-w-3xl space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ApplicationSection({
  number,
  title,
  description,
  icon: Icon,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-primary-50 text-primary-700">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">
              {number}. {title}
            </CardTitle>
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function OwnerApplicationScreen() {
  const t = useTranslations('ownerApplication');
  const router = useAppRouter();
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const applicationQuery = useMyOwnerApplication(Boolean(user) && role === 'customer');
  const submitMutation = useSubmitOwnerApplication();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OwnerApplicationInput>({
    resolver: zodResolver(ownerApplicationSchema),
    defaultValues: {
      businessName: '',
      phone: '',
      address: '',
      lat: null,
      lng: null,
      taxCode: undefined,
      bankBin: '',
      bankName: '',
      accountNo: '',
      accountName: '',
      note: '',
      idCardUrl: '',
    },
  });

  const [location, setLocation] = React.useState<MapCoordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
  const [mapStatus, setMapStatus] = React.useState<string | null>(null);
  const isMapClickRef = React.useRef(false);

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login?next=%2Fowner%2Fapply');
    } else if (!isAuthLoading && role === 'owner') {
      router.replace('/owner/dashboard');
    } else if (!isAuthLoading && role === 'admin') {
      router.replace('/admin/dashboard');
    }
  }, [isAuthLoading, role, router, user]);

  React.useEffect(() => {
    const application = applicationQuery.data;
    if (application?.status === 'rejected') {
      reset({
        businessName: application.businessName,
        phone: application.phone ?? application.user.phone ?? '',
        address: application.address ?? '',
        lat: application.lat ?? null,
        lng: application.lng ?? null,
        taxCode: application.taxCode ?? undefined,
        bankBin: application.bankBin ?? '',
        bankName: application.bankName ?? '',
        accountNo: application.accountNo ?? '',
        accountName: application.accountName ?? '',
        note: application.note ?? '',
        idCardUrl: application.idCardUrl ?? '',
      });
    }
    if (application?.lat && application?.lng) {
      setLocation([Number(application.lat), Number(application.lng)]);
    }
  }, [applicationQuery.data, reset]);

  // Tự động điền số điện thoại nếu tài khoản đã có sẵn SĐT
  React.useEffect(() => {
    if (user?.phone && !watch('phone') && !applicationQuery.data) {
      setValue('phone', user.phone);
    }
  }, [user?.phone, setValue, watch, applicationQuery.data]);

  const addressValue = watch('address');

  // Khi người dùng gõ / sửa địa chỉ: Debounce tự động kéo map đến vị trí
  React.useEffect(() => {
    if (isMapClickRef.current) {
      isMapClickRef.current = false;
      return;
    }
    const { address } = extractAddressAndNote(addressValue || '');
    if (!address || address.length < 4) return;

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      setMapStatus('Đang định vị địa chỉ trên bản đồ...');
      try {
        const coords = await geocodeAddress(address);
        if (coords) {
          setLocation(coords);
          setValue('lat', coords[0]);
          setValue('lng', coords[1]);
          setMapStatus(`Đã tự động kéo bản đồ đến vị trí: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`);
        } else {
          setMapStatus(null);
        }
      } catch {
        setMapStatus(null);
      } finally {
        setIsGeocoding(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [addressValue, setValue]);

  // Khi click cắm ghim trên map: Tự động đảo ngược tọa độ thành địa chỉ tiếng Việt
  const handlePlacePin = async (coords: MapCoordinates) => {
    setLocation(coords);
    setValue('lat', coords[0]);
    setValue('lng', coords[1]);
    setIsGeocoding(true);
    setMapStatus(`Đã ghim mốc: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}. Đang tải địa chỉ...`);

    try {
      isMapClickRef.current = true;
      const resolvedAddress = await reverseGeocode(coords[0], coords[1]);
      if (resolvedAddress) {
        const current = addressValue || '';
        const match = current.match(/\(\*.*?\)/);
        const extraNote = match ? ` ${match[0]}` : '';
        const fullAddress = `${resolvedAddress}${extraNote}`.trim();
        setValue('address', fullAddress, { shouldValidate: true });
        setMapStatus('Đã tự động điền địa chỉ theo vị trí ghim trên bản đồ.');
      } else {
        setMapStatus(`Đã ghim vị trí tọa độ (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`);
      }
    } catch {
      setMapStatus(`Đã ghim vị trí tọa độ (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Khi nhấn nút "Định vị của tôi": Lấy GPS thiết bị và kéo bản đồ đến
  const handleGetMyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setIsLocating(true);
    setMapStatus('Đang lấy vị trí hiện tại từ thiết bị của bạn...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: MapCoordinates = [pos.coords.latitude, pos.coords.longitude];
        await handlePlacePin(coords);
        setIsLocating(false);
        toast.success('Đã định vị thành công vị trí hiện tại của bạn!');
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt để sử dụng tính năng này.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Tín hiệu vị trí thiết bị hiện không khả dụng.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Quá thời gian lấy vị trí GPS, vui lòng thử lại.';
        }
        setMapStatus(msg);
        toast.error(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const onInvalid = (fieldErrors: typeof errors) => {
    const errorEntries = Object.entries(fieldErrors);
    const firstEntry = errorEntries[0];
    if (firstEntry) {
      const [firstKey, firstError] = firstEntry;
      const message =
        (firstError && 'message' in firstError && typeof firstError.message === 'string'
          ? firstError.message
          : null) || 'Vui lòng kiểm tra lại các thông tin bắt buộc còn thiếu.';
      toast.error(message);

      // Cuộn mượt đến trường bị lỗi đầu tiên và focus
      const idMap: Record<string, string> = {
        businessName: 'owner-application-business-name',
        phone: 'owner-application-phone',
        taxCode: 'owner-application-tax-code',
        address: 'owner-application-address',
        bankBin: 'owner-application-bank',
        accountNo: 'owner-application-account-number',
        accountName: 'owner-application-account-holder',
        note: 'owner-application-description',
        idCardUrl: 'owner-application-document-url',
      };
      const elementId = idMap[firstKey];
      const element = elementId ? document.getElementById(elementId) : null;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const onSubmit = async (input: OwnerApplicationInput) => {
    setServerError(null);
    try {
      const resolvedBankName = input.bankName || (input.bankBin ? bankNameFromBin(input.bankBin) : '');
      await submitMutation.mutateAsync({
        businessName: input.businessName,
        phone: input.phone,
        address: input.address,
        lat: location ? location[0] : (input.lat ?? null),
        lng: location ? location[1] : (input.lng ?? null),
        bankBin: input.bankBin,
        bankName: resolvedBankName,
        accountNo: input.accountNo,
        accountName: input.accountName,
        ...(input.note ? { note: input.note } : {}),
        ...(input.idCardUrl ? { idCardUrl: input.idCardUrl } : {}),
        ...(input.taxCode ? { taxCode: input.taxCode } : {}),
      });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : t('submitError');
      setServerError(msg);
      toast.error(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isAuthLoading || !user || role !== 'customer' || applicationQuery.isLoading) {
    return (
      <main className="container py-10 md:py-14">
        <ApplicationLoading />
      </main>
    );
  }

  const isNotFoundError =
    applicationQuery.error instanceof ApiError &&
    (applicationQuery.error.status === 404 || applicationQuery.error.code === 'NOT_FOUND');

  if (applicationQuery.error && !isNotFoundError) {
    return (
      <main className="container max-w-4xl py-10 md:py-14">
        <ErrorState
          error={applicationQuery.error}
          onRetry={() => {
            void applicationQuery.refetch();
          }}
        />
      </main>
    );
  }

  const application = applicationQuery.data;

  return (
    <main className="container max-w-4xl py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary-700">
            <Building2 className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t('description')}</p>
        </header>

        {application?.status === 'pending' ? (
          <Card className="border-warning/30">
            <CardContent className="flex gap-4 p-5 sm:p-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900">{t('pendingTitle')}</h2>
                <p className="mt-1 text-sm text-neutral-600">{t('pendingDescription')}</p>
                <p className="mt-3 text-sm font-medium text-neutral-700">{application.businessName}</p>
              </div>
            </CardContent>
          </Card>
        ) : application?.status === 'approved' ? (
          <Card className="border-success/30">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <BadgeCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-neutral-900">{t('approvedTitle')}</h2>
                <p className="mt-1 text-sm text-neutral-600">{t('approvedDescription')}</p>
              </div>
              <Button asChild variant="primary">
                <Link href="/owner/dashboard">
                  {t('openOwnerDashboard')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            {application?.status === 'rejected' && (
              <div
                role="alert"
                className="rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-neutral-700"
              >
                <p className="font-semibold text-danger">{t('rejectedTitle')}</p>
                <p className="mt-1">{t('rejectedDescription')}</p>
                {application.rejectReason && (
                  <p className="mt-2">
                    <span className="font-medium">{t('rejectionReason')}: </span>
                    {application.rejectReason}
                  </p>
                )}
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {serverError}
              </div>
            )}

            <ApplicationSection
              number="1"
              title={t('businessSectionTitle')}
              description={t('businessSectionDescription')}
              icon={Building2}
            >
              <FormField
                label={t('businessNameLabel')}
                htmlFor="owner-application-business-name"
                required
                error={errors.businessName?.message}
              >
                <Input
                  id="owner-application-business-name"
                  autoComplete="organization"
                  placeholder={t('businessNamePlaceholder')}
                  aria-invalid={Boolean(errors.businessName)}
                  {...register('businessName')}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('phoneLabel')}
                  htmlFor="owner-application-phone"
                  required
                  error={errors.phone?.message}
                >
                  <Input
                    id="owner-application-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t('phonePlaceholder')}
                    aria-invalid={Boolean(errors.phone)}
                    {...register('phone')}
                  />
                </FormField>
                <FormField
                  label={t('taxCodeLabel')}
                  htmlFor="owner-application-tax-code"
                  hint={t('taxCodeHint')}
                  error={errors.taxCode?.message}
                >
                  <Input
                    id="owner-application-tax-code"
                    inputMode="numeric"
                    placeholder={t('taxCodePlaceholder')}
                    aria-invalid={Boolean(errors.taxCode)}
                    {...register('taxCode', {
                      setValueAs: (value: string) => value.trim() || undefined,
                    })}
                  />
                </FormField>
              </div>
              <FormField
                label={t('addressLabel')}
                htmlFor="owner-application-address"
                required
                error={errors.address?.message}
              >
                <Input
                  id="owner-application-address"
                  autoComplete="street-address"
                  placeholder={t('addressPlaceholder')}
                  aria-invalid={Boolean(errors.address)}
                  {...register('address')}
                />
              </FormField>

              {/* Bản đồ định vị cơ sở thể thao */}
              <div className="mt-3 flex flex-col gap-2 rounded-btn border border-neutral-200/80 bg-neutral-50/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-primary-600" aria-hidden="true" />
                    <span className="text-xs font-semibold text-neutral-800">
                      Ghim vị trí cơ sở trên bản đồ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {location && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-neutral-500 hover:text-danger"
                        onClick={() => {
                          setLocation(null);
                          setValue('lat', null);
                          setValue('lng', null);
                          setMapStatus(null);
                        }}
                      >
                        Bỏ ghim
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500">
                  Click vào bản đồ để cắm ghim tự động điền địa chỉ, hoặc nhập địa chỉ bên trên để bản đồ tự kéo đến.
                  Để ghi chú thêm (như số tầng, cổng phụ...), chủ sân có thể mở ngoặc{' '}
                  <code className="rounded bg-neutral-200 px-1 py-0.5 text-neutral-700">(* Ghi chú...)</code> ở cuối ô địa chỉ.
                </p>

                <div className="relative aspect-video w-full overflow-hidden rounded-btn border border-neutral-200 bg-neutral-100 sm:aspect-[21/9]">
                  <VenueLocationMapWrapper
                    className="size-full"
                    center={location ?? [21.0285, 105.8542]}
                    marker={location}
                    onPlacePin={handlePlacePin}
                    scrollWheelZoom={true}
                  />

                  {/* Nút định vị nổi trên bản đồ kiểu Google Maps */}
                  <button
                    type="button"
                    onClick={handleGetMyLocation}
                    disabled={isLocating}
                    className="absolute right-3 top-3 z-[400] flex size-8 items-center justify-center rounded-btn bg-bg-card/95 text-text-primary shadow-md ring-1 ring-border transition-colors hover:bg-bg-subtle hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                    title="Định vị của tôi (vị trí hiện tại)"
                    aria-label="Định vị của tôi"
                  >
                    {isLocating ? (
                      <Loader2 className="size-4 animate-spin text-primary-600" />
                    ) : (
                      <LocateFixed className="size-4 text-primary-600" />
                    )}
                  </button>

                  {isGeocoding && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-btn bg-bg-card/95 px-3 py-1.5 text-xs font-medium text-text-primary shadow-md">
                        <Loader2 className="size-4 animate-spin text-primary-600" />
                        <span>Đang đồng bộ tọa độ & địa chỉ...</span>
                      </div>
                    </div>
                  )}
                </div>

                {mapStatus && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{mapStatus}</span>
                  </p>
                )}
                {location && (
                  <p className="font-mono text-[11px] text-neutral-500">
                    Tọa độ GPS: {location[0].toFixed(6)}, {location[1].toFixed(6)}
                  </p>
                )}
              </div>
            </ApplicationSection>

            <ApplicationSection
              number="2"
              title={t('accountSectionTitle')}
              description={t('accountSectionDescription')}
              icon={Banknote}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('bankLabel')}
                  htmlFor="owner-application-bank"
                  required
                  error={errors.bankBin?.message}
                >
                  <NativeSelect
                    id="owner-application-bank"
                    aria-invalid={Boolean(errors.bankBin)}
                    defaultValue=""
                    {...register('bankBin', {
                      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                        const bank = SUPPORTED_BANKS.find((item) => item.bin === event.target.value);
                        setValue('bankName', bank?.name ?? '', {
                          shouldValidate: true,
                        });
                      },
                    })}
                  >
                    <option value="" disabled>
                      {t('bankPlaceholder')}
                    </option>
                    {SUPPORTED_BANKS.map((bank) => (
                      <option key={bank.bin} value={bank.bin}>
                        {bank.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  label={t('accountNumberLabel')}
                  htmlFor="owner-application-account-number"
                  required
                  error={errors.accountNo?.message}
                >
                  <Input
                    id="owner-application-account-number"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t('accountNumberPlaceholder')}
                    aria-invalid={Boolean(errors.accountNo)}
                    {...register('accountNo')}
                  />
                </FormField>
              </div>
              <FormField
                label={t('accountHolderLabel')}
                htmlFor="owner-application-account-holder"
                required
                error={errors.accountName?.message}
              >
                <Input
                  id="owner-application-account-holder"
                  autoComplete="name"
                  placeholder={t('accountHolderPlaceholder')}
                  aria-invalid={Boolean(errors.accountName)}
                  {...register('accountName')}
                />
              </FormField>
            </ApplicationSection>

            <ApplicationSection
              number="3"
              title={t('reviewSectionTitle')}
              description={t('reviewSectionDescription')}
              icon={FileText}
            >
              <FormField
                label={t('descriptionLabel')}
                htmlFor="owner-application-description"
                hint={t('descriptionHint')}
                error={errors.note?.message}
              >
                <Textarea
                  id="owner-application-description"
                  rows={4}
                  maxLength={2000}
                  placeholder={t('descriptionPlaceholder')}
                  aria-invalid={Boolean(errors.note)}
                  {...register('note', {
                    setValueAs: (value: string) => value.trim() || undefined,
                  })}
                />
              </FormField>
              <FormField
                label={t('documentUrlLabel')}
                htmlFor="owner-application-document-url"
                hint={t('documentUrlHint')}
                error={errors.idCardUrl?.message}
              >
                <Input
                  id="owner-application-document-url"
                  type="url"
                  inputMode="url"
                  placeholder={t('documentUrlPlaceholder')}
                  aria-invalid={Boolean(errors.idCardUrl)}
                  {...register('idCardUrl', {
                    setValueAs: (value: string) => value.trim() || undefined,
                  })}
                />
              </FormField>
              <label className="flex cursor-pointer items-start gap-3 rounded-btn border border-neutral-200 p-3.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 size-4 shrink-0 accent-primary-700 focus-visible:ring-primary-600"
                />
                <span>{t('confirmation')}</span>
              </label>
            </ApplicationSection>

            {serverError && (
              <div
                role="alert"
                className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="flex gap-2 text-sm text-text-secondary">
                <FileText className="mt-0.5 size-4 shrink-0 text-text-disabled" aria-hidden="true" />
                <span>{t('submissionNote')}</span>
              </p>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitMutation.isPending}
                className="w-full shrink-0 sm:w-auto"
              >
                <Send aria-hidden="true" />
                {application?.status === 'rejected' ? t('resubmitButton') : t('submitButton')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
