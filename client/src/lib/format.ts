export const money = (value: number, compact = false) => new Intl.NumberFormat('vi-VN', compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(Number(value) || 0);
export const currency = (value: number, compact = false) => `${money(value, compact)} ₫`;
export const dateShort = (value: string | Date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short' }).format(new Date(value));
export const dateLong = (value: string | Date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const isoDate = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
export const accountLabel = (kind: string) => ({ cash: 'Tiền mặt', bank: 'Ngân hàng', ewallet: 'Ví điện tử' }[kind] ?? kind);
export const paymentLabel = (kind: string) => ({ cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử', other: 'Khác' }[kind] ?? kind);
export const categoryLabel = (value: string | { name: string }) => typeof value === 'string' ? value : value?.name ?? 'Chưa phân loại';
export const idOf = (value: string | { _id: string }) => typeof value === 'string' ? value : value?._id;
