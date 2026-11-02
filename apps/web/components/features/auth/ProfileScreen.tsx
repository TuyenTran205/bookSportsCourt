'use client';

import * as React from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { changePasswordSchema, updateProfileSchema } from '@bsc/shared';
import type { ChangePasswordInput, UpdateProfileInput, User } from '@bsc/shared';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { changePassword, updateProfile, uploadAvatar } from '@/lib/api/endpoints/auth';
import { ApiError } from '@/lib/api/errors';
import { authKeys, useAuth } from '@/lib/hooks/useAuth';

/** ProfileScreen – CUS-14/CUS-15: ảnh đại diện, sửa thông tin cá nhân và đổi mật khẩu. */
export function ProfileScreen() {
  const t = useTranslations('profile');
  const { user, role, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <main className="container max-w-2xl space-y-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const roleLabel =
    role === 'admin' ? t('roleAdmin') : role === 'owner' ? t('roleOwner') : t('roleCustomer');

  return (
    <main className="container max-w-2xl space-y-6 py-8">
      <PageHeader title={t('title')} description={t('desc')} />
      <AvatarSection user={user} />
      <ProfileForm
        key={user.id}
        initial={{ fullName: user.fullName, phone: user.phone ?? '' }}
        email={user.email}
        roleLabel={roleLabel}
      />
      <PasswordForm />
    </main>
  );
}

/** Khối quản lý và tải ảnh đại diện người dùng (CUS-15). */
function AvatarSection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async (result) => {
      queryClient.setQueryData(authKeys.me(), (old: { user?: User; ownerProfile?: unknown } | null) => ({
        ...old,
        user: result.user,
      }));
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      toast.success('Cập nhật ảnh đại diện thành công');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Tải ảnh đại diện thất bại');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:gap-6">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-neutral-200 bg-neutral-100 shadow-xs">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.fullName}
              width={96}
              height={96}
              unoptimized
              className="size-full rounded-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-primary-100 text-2xl font-bold text-primary-700">
              {user.fullName.slice(0, 1).toUpperCase()}
            </div>
          )}

          {uploadMutation.isPending && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/40"
              aria-label="Đang tải ảnh lên"
            >
              <Spinner className="size-6 text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 sm:items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-hidden="true"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="md"
            className="min-h-11"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden="true" />
            <span>Đổi ảnh đại diện</span>
          </Button>
          <span className="text-xs text-neutral-500">
            Định dạng JPG, PNG hoặc WebP. Dung lượng tối đa 2MB.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileForm({
  initial,
  email,
  roleLabel,
}: {
  initial: { fullName: string; phone: string };
  email: string;
  roleLabel: string;
}) {
  const t = useTranslations('profile');
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: initial,
  });

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      reset({ fullName: variables.fullName, phone: variables.phone ?? '' });
      toast.success(t('updated'));
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t('updateFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('personalInfo')}</CardTitle>
        <CardDescription>{t('personalInfoDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((data) => save.mutate({ ...data, phone: data.phone || undefined }))}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label={t('email')} htmlFor="profile-email" hint={t('emailLocked')}>
            <Input id="profile-email" value={email} readOnly disabled />
          </FormField>
          <FormField label={t('role')} htmlFor="profile-role">
            <Input id="profile-role" value={roleLabel} readOnly disabled />
          </FormField>
          <FormField label={t('fullName')} htmlFor="profile-name" required error={errors.fullName?.message}>
            <Input
              id="profile-name"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
          </FormField>
          <FormField label={t('phone')} htmlFor="profile-phone" error={errors.phone?.message}>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!isDirty} loading={save.isPending}>
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const t = useTranslations('profile');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const change = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      reset();
      toast.success(t('passwordChanged'));
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t('passwordFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('changePassword')}</CardTitle>
        <CardDescription>{t('changePasswordDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => change.mutate(data))} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('currentPassword')}
            htmlFor="pw-current"
            required
            error={errors.currentPassword?.message}
          >
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...register('currentPassword')}
            />
          </FormField>
          <FormField label={t('newPassword')} htmlFor="pw-new" required error={errors.newPassword?.message}>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register('newPassword')}
            />
          </FormField>
          <FormField
            label={t('confirmPassword')}
            htmlFor="pw-confirm"
            required
            error={errors.confirmPassword?.message}
          >
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={change.isPending}>
              {t('changePassword')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
