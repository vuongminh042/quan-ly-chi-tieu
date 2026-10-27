import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { del, get, post } from '../lib/api';
import type { AppOutlet } from '../components/AppShell';
import { useConfirm } from '../components/ConfirmDialog';
import { Button, EmptyState, PageTitle, Panel } from '../components/UI';
import { AdminSupportInbox } from '../components/AdminSupportInbox';
import { io } from 'socket.io-client';
import { useAuth } from '../lib/auth';

type ManagedUser = { id: string; name: string; email: string; avatar?: string; isActive: boolean; isAdmin: boolean; createdAt: string };
type UserList = { items: ManagedUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
type AdminAction = { adminEmail: string; targetEmail: string; action: 'account_restored'; createdAt: string };

function dateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Admin() {
  const { notify } = useOutletContext<AppOutlet>();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserList>({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'deactivated'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setBusy(true);
    try {
      const [userResult, actionResult] = await Promise.all([
      get<UserList>('/admin/users', { search, status, page }),
      get<{ items: AdminAction[] }>('/admin/actions'),
      ]);
      if (currentRequestId !== requestId.current) return;
      setUsers(userResult);
      setActions(actionResult.items);
    } catch (error: any) {
      if (currentRequestId === requestId.current)
        notify(error?.response?.data?.error ?? 'Không tải được dữ liệu quản trị.');
    } finally {
      if (currentRequestId === requestId.current) setBusy(false);
    }
  }, [notify, page, search, status]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      auth: { role: 'admin' },
      withCredentials: true,
    });
    socket.on('admin:accounts-changed', () => { void load(); });
    return () => { socket.disconnect(); };
  }, [load]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function restoreAccount(target: ManagedUser) {
    if (!await confirm({
      title: 'Khôi phục tài khoản?',
      message: `Tài khoản ${target.email} sẽ được kích hoạt lại. Dữ liệu và số dư hiện có được giữ nguyên.`,
      confirmLabel: 'Khôi phục',
    })) return;
    setRestoring(target.id);
    try {
      const result = await post<{ warning?: string }>(`/admin/users/${target.id}/restore`);
      notify(result.warning ?? 'Đã khôi phục tài khoản.');
      void load();
    } catch (error: any) {
      notify(error?.response?.data?.error ?? 'Không thể khôi phục tài khoản.');
    } finally {
      setRestoring(null);
    }
  }

  async function permanentlyDeleteAccount() {
    if (!deleteTarget || deleteConfirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) return;
    setDeleting(true);
    try {
      const result = await del<{ deleted: boolean; warning?: string }>(`/admin/users/${deleteTarget.id}`);
      notify(result.warning ?? `Đã xóa vĩnh viễn tài khoản ${deleteTarget.email} và dữ liệu liên quan.`);
      setDeleteTarget(null);
      setDeleteConfirmation('');
      void load();
    } catch (error: any) {
      notify(error?.response?.data?.error ?? 'Không thể xóa tài khoản.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="QUẢN LÝ NGƯỜI DÙNG"
        title="Quản trị tài khoản."
        description="Tra cứu, khôi phục hoặc xóa vĩnh viễn tài khoản và dữ liệu liên quan."
      />
      <AdminSupportInbox />
      <div className="admin-summary">
        <span><Users size={18} /> Tài khoản phù hợp</span>
        <strong>{users.pagination.total}</strong>
      </div>
      <Panel className="admin-users-panel">
        <form className="admin-toolbar" onSubmit={submitSearch}>
          <label className="admin-search">
            <Search size={16} />
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Tìm theo tên hoặc email" maxLength={120} />
          </label>
          <select value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="Lọc trạng thái tài khoản">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="deactivated">Đã vô hiệu hóa</option>
          </select>
          <Button type="submit" variant="secondary">Tìm kiếm</Button>
        </form>
        {busy ? <div className="table-loading">Đang tải tài khoản…</div> : users.items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Tài khoản</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>{users.items.map(account => (
                <tr key={account.id}>
                  <td><div className="table-transaction"><span className="admin-user-icon">{account.avatar ? <img src={account.avatar} alt={`Ảnh đại diện ${account.name}`} /> : <Users size={16}/>}</span><span><strong>{account.name}</strong><small>{account.email}</small></span></div></td>
                  <td>{dateTime(account.createdAt)}</td>
                  <td><span className={`admin-status ${account.isActive ? 'active' : 'deactivated'}`}>{account.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></td>
                  <td className="align-right">
                    {!account.isActive && <Button variant="secondary" disabled={restoring === account.id} onClick={() => void restoreAccount(account)}><RotateCcw size={14}/>{restoring === account.id ? 'Đang khôi phục…' : 'Khôi phục'}</Button>}{' '}
                    {!account.isAdmin && account.id !== user?.id && <Button variant="danger" onClick={() => { setDeleteTarget(account); setDeleteConfirmation(''); }}><Trash2 size={14}/>Xóa vĩnh viễn</Button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Không tìm thấy tài khoản" hint="Thử từ khóa khác hoặc đổi bộ lọc trạng thái."/>}
        <div className="table-footer">
          <span>{users.pagination.total} tài khoản</span>
          <div>
            <button disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ChevronLeft size={17}/></button>
            <span>{page} / {Math.max(1, users.pagination.totalPages)}</span>
            <button disabled={page >= users.pagination.totalPages || busy} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ChevronRight size={17}/></button>
          </div>
        </div>
      </Panel>
      <Panel title="Nhật ký khôi phục" action={<span className="settings-count">50 thao tác gần nhất</span>}>
        {actions.length ? <div className="admin-audit-list">{actions.map((action, index) => (
          <div className="admin-audit-row" key={`${action.createdAt}-${action.targetEmail}-${index}`}>
            <span className="admin-audit-icon"><Check size={15}/></span>
            <span><strong>{action.adminEmail}</strong> đã khôi phục <strong>{action.targetEmail}</strong><small>{dateTime(action.createdAt)}</small></span>
          </div>
        ))}</div> : <EmptyState title="Chưa có thao tác khôi phục" hint="Các lần khôi phục tài khoản sẽ được ghi lại tại đây."/>}
      </Panel>
      <div className="admin-data-note"><ShieldCheck size={16}/> Khôi phục chỉ kích hoạt lại tài khoản. Giao dịch, tài khoản tiền và số dư được giữ nguyên.</div>
      {deleteTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
          <section className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="modal-head">
              <div><span className="eyebrow">XÓA VĨNH VIỄN</span><h2 id="delete-account-title">Xóa tài khoản này?</h2></div>
            </div>
            <div className="form-stack">
              <p>Tài khoản <strong>{deleteTarget.email}</strong>, giao dịch, tài khoản tiền, mục tiêu và hội thoại hỗ trợ liên quan sẽ bị xóa vĩnh viễn. Không thể hoàn tác.</p>
              <label>Nhập email tài khoản để xác nhận
                <input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" autoFocus disabled={deleting} />
              </label>
              <div className="modal-actions">
                <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button>
                <Button type="button" variant="danger" onClick={() => void permanentlyDeleteAccount()} disabled={deleting || deleteConfirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}>{deleting ? 'Đang xóa…' : 'Xóa vĩnh viễn'}</Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
