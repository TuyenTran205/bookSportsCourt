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
  type LucideIcon,
} from 'lucide-react';

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
import { SUPPORTED_BANKS } from '@/lib/utils/payment-qr';
import { useMyOwnerApplication, useSubmitOwnerApplication } from '@/lib/hooks/useOwnerApplication';

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
    formState: { errors },
  } = useForm<OwnerApplicationInput>({
    resolver: zodResolver(ownerApplicationSchema),
    defaultValues: {
      businessName: '',
      phone: '',
      address: '',
      taxCode: undefined,
      bankBin: '',
      bankName: '',
      accountNo: '',
      accountName: '',
      note: '',
      idCardUrl: '',
    },
  });

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
        taxCode: application.taxCode ?? undefined,
        bankBin: application.bankBin ?? '',
        bankName: application.bankName ?? '',
        accountNo: application.accountNo ?? '',
        accountName: application.accountName ?? '',
        note: application.note ?? '',
        idCardUrl: application.idCardUrl ?? '',
      });
    }
  }, [applicationQuery.data, reset]);

  const onSubmit = async (input: OwnerApplicationInput) => {
    setServerError(null);
    try {
      await submitMutation.mutateAsync({
        businessName: input.businessName,
        phone: input.phone,
        address: input.address,
        bankBin: input.bankBin,
        bankName: input.bankName,
        accountNo: input.accountNo,
        accountName: input.accountName,
        ...(input.note ? { note: input.note } : {}),
        ...(input.idCardUrl ? { idCardUrl: input.idCardUrl } : {}),
        ...(input.taxCode ? { taxCode: input.taxCode } : {}),
      });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : t('submitError'));
    }
  };

  if (isAuthLoading || !user || role !== 'customer' || applicationQuery.isLoading) {
    return (
      <main className="container py-10 md:py-14">
        <ApplicationLoading />
      </main>
    );
  }

  if (applicationQuery.error) {
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="flex flex-col gap-4 rounded-card border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="flex gap-2 text-sm text-neutral-600">
                <FileText className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
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
