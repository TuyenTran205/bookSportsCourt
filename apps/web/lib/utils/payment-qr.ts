/**
 * Dựng chuỗi QR chuyển khoản liên ngân hàng (EMVCo / NAPAS 247) hoàn toàn ở client
 * — docs/18-decision-log.md ADR-021. Không gọi dịch vụ ngoài, server không lưu ảnh QR.
 *
 * Cấu trúc TLV: [id 2 ký tự][độ dài 2 chữ số][giá trị]. Dòng cuối là CRC16-CCITT
 * của toàn bộ chuỗi phía trước (kể cả "6304").
 */

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface TransferQrInput {
  bankBin: string;
  accountNo: string;
  /** VND, số nguyên. */
  amount: number;
  /** Nội dung chuyển khoản để chủ sân đối soát. */
  transferCode: string;
}

export function buildTransferQrPayload({
  bankBin,
  accountNo,
  amount,
  transferCode,
}: TransferQrInput): string {
  const beneficiary = tlv('00', bankBin) + tlv('01', accountNo);
  const merchantAccount = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');

  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchantAccount) +
    tlv('53', '704') +
    tlv('54', String(Math.round(amount))) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', transferCode)) +
    '6304';

  return body + crc16(body);
}

/** Tên ngân hàng theo mã BIN để hiển thị dạng văn bản (dự phòng khi không quét được). */
const BANK_NAMES: Record<string, string> = {
  '970436': 'Vietcombank',
  '970415': 'VietinBank',
  '970418': 'BIDV',
  '970422': 'MB Bank',
  '970407': 'Techcombank',
  '970432': 'VPBank',
  '970416': 'ACB',
  '970423': 'TPBank',
  '970403': 'Sacombank',
};

export function bankNameFromBin(bin: string): string {
  return BANK_NAMES[bin] ?? `Ngân hàng (BIN ${bin})`;
}
