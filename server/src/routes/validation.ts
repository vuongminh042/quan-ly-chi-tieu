import { z } from 'zod';

const money = z.coerce.number().finite().positive().max(1_000_000_000_000);
const dateText = z.coerce.date();
const displayName = z.string().trim().min(2).max(80).regex(/^[\p{L}\p{M}]+(?:[ .'\u2019-][\p{L}\p{M}]+)*$/u, 'Tên chỉ gồm chữ cái, dấu cách, dấu chấm, dấu nháy hoặc dấu gạch nối.');
const email = z.string().trim().max(254).email().transform(value => value.toLowerCase());
const password = z.string().min(1).max(128).refine(value => value.trim().length > 0, 'Mật khẩu không được chỉ chứa khoảng trắng.');
export const registerSchema = z.object({ name: displayName, email, password: password.refine(value => value.length >= 8, 'Mật khẩu cần ít nhất 8 ký tự.') });
export const loginSchema = z.object({ email, password });
export const accountSchema = z.object({ name: z.string().trim().min(1).max(80), kind: z.enum(['cash', 'bank', 'ewallet']), openingBalance: z.coerce.number().finite().min(0).max(1_000_000_000_000), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(['cash', 'bank', 'ewallet']).optional(),
  balance: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).refine(input => Object.keys(input).length > 0, 'Cần có ít nhất một thông tin để cập nhật.');
export const categorySchema = z.object({ name: z.string().trim().min(1).max(60), kind: z.enum(['income', 'expense']), icon: z.string().max(30).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
export const transactionSchema = z.object({ kind: z.enum(['income', 'expense']), amount: money, date: dateText, categoryId: z.string().min(1), accountId: z.string().min(1), note: z.string().max(500).optional().default(''), paymentMethod: z.enum(['cash', 'card', 'transfer', 'ewallet', 'other']).optional().default('cash') });
export const budgetSchema = z.object({ categoryId: z.string().min(1), period: z.string().regex(/^\d{4}-\d{2}$/), amount: money });
export const goalSchema = z.object({ name: z.string().trim().min(1).max(100), targetAmount: money, deadline: z.coerce.date().optional(), icon: z.string().max(30).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
export const contributionSchema = z.object({ amount: money });
