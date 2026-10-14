'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CreditCard, FileText, Send } from 'lucide-react';
import { z } from 'zod';

import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { useSubmitOwnerApplication } from '@/lib/hooks/useOwnerApply';

const POPULAR_BANKS = [
  'Vietcombank (Ngân hàng Ngoại thương Việt Nam)',
  'MB Bank (Ngân hàng Quân đội)',
  'Techcombank (Ngân hàng Kỹ thương)',
  'BIDV (Ngân hàng Đầu tư và Phát triển)',
  'VietinBank (Ngân hàng Công thương)',
  'Agribank (Ngân hàng Nông nghiệp & PTNT)',
  'ACB (Ngân hàng Á Châu)',
  'VPBank (Ngân hàng Việt Nam Thịnh vượng)',
  'TPBank (Ngân hàng Tiên Phong)',
  'Sacombank (Ngân hàng Sài Gòn Thương tín)',
  'HDBank (Ngân hàng Phát triển TP.HCM)',
  'VIB (Ngân hàng Quốc tế)',
];

const ownerApplyFormSchema = z.object({
  businessName: z
    .string()
    .min(2, 'Tên cơ sở phải có ít nhất 2 ký tự')
    .max(200, 'Tên cơ sở tối đa 200 ký tự')
    .trim(),
  taxCode: z
    .string()
    .refine((val) => !val || /^\d{10}(\d{3})?$/.test(val), {
      message: 'Mã số thuế gồm 10 hoặc 13 chữ số',
    })
    .optional(),
  phone: z
    .string()
    .regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng Việt Nam')
    .trim(),
  address: z
    .string()
    .min(5, 'Vui lòng nhập địa chỉ cụ thể (ít nhất 5 ký tự)')
    .max(255)
    .trim(),
  bankName: z.string().min(1, 'Vui lòng chọn ngân hàng nhận tiền cọc'),
  accountNo: z
    .string()
    .min(6, 'Số tài khoản phải có ít nhất 6 chữ số')
    .max(30, 'Số tài khoản tối đa 30 chữ số')
    .regex(/^\d+$/, 'Số tài khoản chỉ gồm chữ số')
    .trim(),
  accountName: z
    .string()
    .min(2, 'Vui lòng nhập tên chủ tài khoản')
    .max(100)
    .trim()
    .toUpperCase(),
  note: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
  idCardUrl: z.string().optional(),
});

type OwnerApplyFormData = z.infer<typeof ownerApplyFormSchema>;

export interface OwnerApplyFormProps {
  defaultValues?: Partial<OwnerApplyFormData>;
  onSuccess?: () => void;
}

export function OwnerApplyForm({ defaultValues, onSuccess }: OwnerApplyFormProps) {
  const submitMutation = useSubmitOwnerApplication();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OwnerApplyFormData>({
    resolver: zodResolver(ownerApplyFormSchema),
    defaultValues: {
      businessName: defaultValues?.businessName ?? '',
      taxCode: defaultValues?.taxCode ?? '',
      phone: defaultValues?.phone ?? '',
      address: defaultValues?.address ?? '',
      bankName: defaultValues?.bankName ?? POPULAR_BANKS[0],
      accountNo: defaultValues?.accountNo ?? '',
      accountName: defaultValues?.accountName ?? '',
      note: defaultValues?.note ?? '',
      idCardUrl:
        defaultValues?.idCardUrl ?? 'https://picsum.photos/seed/cccd-apply/800/500',
    },
  });

  const selectedBank = watch('bankName');

  const onSubmit = handleSubmit(async (data) => {
    await submitMutation.mutateAsync({
      businessName: data.businessName,
      phone: data.phone,
      address: data.address,
      taxCode: data.taxCode || undefined,
      bankName: data.bankName,
      accountNo: data.accountNo,
      accountName: data.accountName,
      note: data.note || undefined,
      idCardUrl: data.idCardUrl || undefined,
    });
    onSuccess?.();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Khối 1: Thông tin pháp lý & Liên hệ */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-neutral-100 pb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              1. Thông tin cơ sở kinh doanh
            </h3>
            <p className="text-xs text-neutral-500">
              Tên pháp lý, mã số thuế hoặc CCCD đại diện và địa chỉ cơ sở
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Tên cơ sở / Hộ kinh doanh"
            htmlFor="apply-businessName"
            required
            error={errors.businessName?.message}
            className="sm:col-span-2"
          >
            <Input
              id="apply-businessName"
              placeholder="Ví dụ: CLB Cầu lông Thăng Long hoặc Sân bóng Thành Phát"
              {...register('businessName')}
            />
          </FormField>

          <FormField
            label="Số điện thoại liên hệ chính"
            htmlFor="apply-phone"
            required
            error={errors.phone?.message}
          >
            <Input
              id="apply-phone"
              type="tel"
              placeholder="0912 345 678"
              {...register('phone')}
            />
          </FormField>

          <FormField
            label="Mã số thuế hoặc số CCCD"
            htmlFor="apply-taxCode"
            hint="10 hoặc 13 chữ số"
            error={errors.taxCode?.message}
          >
            <Input
              id="apply-taxCode"
              placeholder="0312345678"
              {...register('taxCode')}
            />
          </FormField>

          <FormField
            label="Địa chỉ cơ sở dự kiến"
            htmlFor="apply-address"
            required
            error={errors.address?.message}
            className="sm:col-span-2"
          >
            <Input
              id="apply-address"
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
              {...register('address')}
            />
          </FormField>
        </div>
      </Card>

      {/* Khối 2: Tài khoản nhận tiền cọc đối soát */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-neutral-100 pb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <CreditCard className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              2. Tài khoản thụ hưởng đối soát
            </h3>
            <p className="text-xs text-neutral-500">
              Tài khoản ngân hàng dùng để nhận tiền cọc chuyển khoản trực tiếp từ khách đặt sân
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="apply-bank" className="text-sm font-medium text-neutral-700">
              Ngân hàng thụ hưởng <span className="text-danger">*</span>
            </label>
            <NativeSelect
              id="apply-bank"
              value={selectedBank}
              onChange={(e) => setValue('bankName', e.target.value)}
            >
              {POPULAR_BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </NativeSelect>
          </div>

          <FormField
            label="Số tài khoản ngân hàng"
            htmlFor="apply-accountNo"
            required
            error={errors.accountNo?.message}
          >
            <Input
              id="apply-accountNo"
              placeholder="19036888999"
              {...register('accountNo')}
            />
          </FormField>

          <FormField
            label="Tên chủ tài khoản (In hoa không dấu)"
            htmlFor="apply-accountName"
            required
            error={errors.accountName?.message}
          >
            <Input
              id="apply-accountName"
              placeholder="NGUYEN VAN A"
              {...register('accountName')}
              onChange={(e) => setValue('accountName', e.target.value.toUpperCase())}
            />
          </FormField>
        </div>
      </Card>

      {/* Khối 3: Giới thiệu & Minh chứng */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-neutral-100 pb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              3. Quy mô & Hồ sơ minh chứng
            </h3>
            <p className="text-xs text-neutral-500">
              Mô tả sơ lược về cơ sở và giấy tờ đại diện để ban quản trị duyệt nhanh chóng
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <FormField
            label="Giới thiệu về cơ sở & Quy mô dự kiến"
            htmlFor="apply-note"
            hint="Ví dụ: Cụm 4 sân cầu lông thảm tiêu chuẩn, đèn LED, trần cao 9m, giữ xe miễn phí..."
            error={errors.note?.message}
          >
            <textarea
              id="apply-note"
              rows={3}
              className="flex w-full rounded-input border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20"
              placeholder="Mô tả số lượng sân con, môn thể thao, tiện ích đi kèm..."
              {...register('note')}
            />
          </FormField>

          <FormField
            label="Ảnh giấy phép kinh doanh / CCCD đại diện"
            htmlFor="apply-idCardUrl"
            hint="URL ảnh minh chứng giấy tờ hợp lệ"
            error={errors.idCardUrl?.message}
          >
            <Input
              id="apply-idCardUrl"
              placeholder="https://..."
              {...register('idCardUrl')}
            />
          </FormField>
        </div>
      </Card>

      {/* Cam kết & Nút nộp */}
      <div className="flex flex-col gap-4 rounded-card border border-neutral-200 bg-neutral-50 p-4 sm:p-6">
        <p className="text-xs text-neutral-600">
          Bằng việc nhấn <strong>Nộp hồ sơ xét duyệt</strong>, bạn cam kết các thông tin cung cấp là
          chính xác và đồng ý với điều khoản hợp tác đối tác của BookSportsCourt (nền tảng áp dụng
          chính sách 0đ phí hoa hồng trong giai đoạn phát triển).
        </p>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitMutation.isPending}
            className="w-full gap-2 sm:w-auto"
          >
            <Send className="size-4" aria-hidden="true" />
            <span>
              {submitMutation.isPending ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ xét duyệt'}
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}
