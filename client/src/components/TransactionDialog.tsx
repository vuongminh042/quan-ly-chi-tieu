import { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";
import { get, post, patch } from "../lib/api";
import { accountLabel, isoDate, idOf } from "../lib/format";
import type {
  Account,
  Category,
  Transaction,
  TransactionInput,
} from "../types";
import { useToast } from "./Toast";
import { Button } from "./UI";

function saveErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === "string") return serverMessage;
    if (!error.response) {
      return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.";
    }
    if (error.response.status >= 500) {
      return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
    }
    return `Không thể lưu giao dịch (mã ${error.response.status}). Vui lòng kiểm tra thông tin và thử lại.`;
  }
  if (error instanceof Error) return error.message;
  return "Không thể lưu giao dịch. Vui lòng thử lại.";
}

export function TransactionDialog({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Transaction | null;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [kind, setKind] = useState<"expense" | "income">(
    initial?.kind ?? "expense",
  );
  const [form, setForm] = useState({
    amount: initial?.amount ? String(initial.amount) : "",
    date: initial?.date ? isoDate(new Date(initial.date)) : isoDate(),
    categoryId: initial ? idOf(initial.categoryId) : "",
    accountId: initial ? idOf(initial.accountId) : "",
    note: initial?.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const showToast = useToast();
  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "expense");
    setForm({
      amount: initial?.amount ? String(initial.amount) : "",
      date: initial?.date ? isoDate(new Date(initial.date)) : isoDate(),
      categoryId: initial ? idOf(initial.categoryId) : "",
      accountId: initial ? idOf(initial.accountId) : "",
      note: initial?.note ?? "",
    });
    void Promise.all([
      get<{ items: Category[] }>("/categories"),
      get<{ items: Account[] }>("/accounts"),
    ])
      .then(([c, a]) => {
        setCategories(c.items);
        setAccounts(a.items);
        setForm((current) => ({
          ...current,
          categoryId:
            current.categoryId ||
            c.items.find((item) => item.kind === (initial?.kind ?? "expense"))
              ?._id ||
            "",
          accountId: current.accountId || a.items[0]?._id || "",
        }));
      })
      .catch((e) =>
        showToast(
          e?.response?.data?.error ?? "Không tải được danh mục và tài khoản.",
          "error",
        ),
      );
  }, [open, initial?._id, showToast]);
  if (!open) return null;
  const options = categories.filter((item) => item.kind === kind);
  const selectedAccountForDisplay = accounts.find(
    (account) => account._id === form.accountId,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount.replace(/\./g, "").replace(/,/g, "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Nhập số tiền lớn hơn 0.", "error");
      return;
    }
    if (!form.categoryId || !form.accountId) {
      showToast("Hãy chọn danh mục và tài khoản.", "error");
      return;
    }
    const selectedAccount = accounts.find(
      (account) => account._id === form.accountId,
    );
    if (!selectedAccount) {
      showToast("Tài khoản đã chọn không tồn tại. Vui lòng chọn lại.", "error");
      return;
    }
    const payload: TransactionInput = {
      ...form,
      kind,
      amount,
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      paymentMethod:
        selectedAccount.kind === "bank"
          ? "transfer"
          : selectedAccount.kind,
    };
    setSaving(true);
    try {
      if (initial)
        await patch(
          `/transactions/${initial._id}`,
          payload as unknown as Record<string, unknown>,
        );
      else
        await post(
          "/transactions",
          payload as unknown as Record<string, unknown>,
        );
      onSaved();
      onClose();
    } catch (error) {
      showToast(saveErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">GHI CHÉP NHANH</span>
            <h2 id="transaction-title">
              {initial ? "Sửa giao dịch" : "Thêm giao dịch"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="form-stack">
          <div className="segmented">
            <button
              type="button"
              className={kind === "expense" ? "active expense-tab" : ""}
              onClick={() => {
                setKind("expense");
                setForm({
                  ...form,
                  categoryId:
                    categories.find((c) => c.kind === "expense")?._id ?? "",
                });
              }}
            >
              Khoản chi
            </button>
            <button
              type="button"
              className={kind === "income" ? "active income-tab" : ""}
              onClick={() => {
                setKind("income");
                setForm({
                  ...form,
                  categoryId:
                    categories.find((c) => c.kind === "income")?._id ?? "",
                });
              }}
            >
              Khoản thu
            </button>
          </div>
          <label>
            Số tiền
            <input
              autoFocus
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Danh mục
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
                required
              >
                <option value="">Chọn danh mục</option>
                {options.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tài khoản
              <select
                value={form.accountId}
                onChange={(e) =>
                  setForm({ ...form, accountId: e.target.value })
                }
                required
              >
                <option value="">Chọn tài khoản</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Ngày
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
            <label>
              Loại tài khoản
              <input
                value={
                  selectedAccountForDisplay
                    ? accountLabel(selectedAccountForDisplay.kind)
                    : "Chọn tài khoản"
                }
                readOnly
                aria-label="Loại tài khoản được xác định tự động"
              />
            </label>
          </div>
          <label>
            Ghi chú
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Ví dụ: Ăn trưa cùng bạn"
              maxLength={500}
            />
          </label>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Đang lưu…"
                : initial
                  ? "Lưu thay đổi"
                  : "Lưu giao dịch"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
