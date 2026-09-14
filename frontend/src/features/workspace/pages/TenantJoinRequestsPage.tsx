import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../app/store/auth.store';
import { notifyStaffChanged, workspaceApi, type TenantJoinRequestItem } from '../api/workspace.api';

type Role = 'staff' | 'leader' | 'manager';

/** Reused by the Owner HR hub so canonical reviews stay in the primary UI. */
export function CanonicalTenantJoinRequestsPanel({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const [rows, setRows] = useState<TenantJoinRequestItem[]>([]);
  const [roles, setRoles] = useState<Record<number, Role>>({});
  const [storeIds, setStoreIds] = useState<Record<number, number[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      setRows(await workspaceApi.getTenantJoinRequests());
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'Không thể tải yêu cầu gia nhập canonical.');
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleStore = (requestId: number, storeId: number, checked: boolean) => {
    setStoreIds((current) => {
      const selected = current[requestId] ?? [];
      return { ...current, [requestId]: checked ? [...new Set([...selected, storeId])] : selected.filter((id) => id !== storeId) };
    });
  };

  const approve = async (requestId: number) => {
    const selected = storeIds[requestId] ?? [];
    if (!selected.length) return setError('Chọn ít nhất một cửa hàng trước khi duyệt.');
    try {
      setBusyId(requestId); setError(null);
      await workspaceApi.approveTenantJoinRequest(requestId, roles[requestId] ?? 'staff', selected);
      notifyStaffChanged(user?.tenantId);
      await load();
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'Không thể duyệt yêu cầu.');
    } finally { setBusyId(null); }
  };

  const reject = async (requestId: number) => {
    try {
      setBusyId(requestId); setError(null);
      await workspaceApi.rejectTenantJoinRequest(requestId);
      await load();
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'Không thể từ chối yêu cầu.');
    } finally { setBusyId(null); }
  };

  const pendingRows = rows.filter((row) => row.status === 'pending');
  const stores = user?.stores ?? [];

  return <section style={{ marginBottom: compact ? 18 : 0, padding: compact ? '18px 20px' : 24, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14 }}>
    <h2 style={{ margin: 0, color: '#2A3B2C', fontSize: compact ? '1.15rem' : '1.4rem' }}>Yêu cầu tham gia cửa hàng</h2>
    <p style={{ margin: '6px 0 0', color: '#78350F' }}>Mã mời Store chỉ tạo yêu cầu chờ duyệt. Owner chọn vai trò và một hoặc nhiều cửa hàng trước khi cấp quyền.</p>
    {error && <p style={{ margin: '14px 0 0', color: '#9F2F2D' }}>{error}</p>}
    {!error && rows.length === 0 && <p style={{ margin: '14px 0 0', color: '#78350F' }}>Chưa có yêu cầu canonical nào.</p>}
    {pendingRows.map((row) => {
      const selected = storeIds[row.id] ?? [];
      const role = roles[row.id] ?? 'staff';
      const busy = busyId === row.id;
      return <article key={row.id} style={{ marginTop: 14, padding: 16, background: '#FAF6F3', border: '1px solid #E8E0D5', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>{row.fullName || row.email || `Account #${row.userId}`}</strong>
            {row.email && <div style={{ marginTop: 3, color: '#687668', fontSize: '.86rem' }}>{row.email}</div>}
            <div style={{ marginTop: 8, color: '#364D39' }}>Store được mời: <strong>{row.requestedStoreName || 'Không xác định'}</strong></div>
          </div>
          <span style={{ padding: '4px 9px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontSize: '.78rem', fontWeight: 700 }}>Chờ duyệt</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 220px) minmax(0, 1fr)', gap: 16, marginTop: 16 }}>
          <label style={{ color: '#364D39', fontWeight: 700 }}>Vai trò
            <select value={role} onChange={(event) => setRoles((current) => ({ ...current, [row.id]: event.target.value as Role }))} style={{ display: 'block', width: '100%', marginTop: 6, padding: 9, border: '1px solid #D1DBD2', borderRadius: 7, background: '#fff' }}>
              <option value="staff">STAFF</option><option value="leader">LEADER</option><option value="manager">MANAGER</option>
            </select>
          </label>
          <fieldset style={{ margin: 0, border: 0, padding: 0 }}>
            <legend style={{ color: '#364D39', fontWeight: 700 }}>Cửa hàng được cấp quyền</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 7 }}>
              {stores.map((store) => <label key={store.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: '#fff', border: '1px solid #D1DBD2', borderRadius: 7, color: '#364D39' }}>
                <input type="checkbox" checked={selected.includes(store.id)} onChange={(event) => toggleStore(row.id, store.id, event.target.checked)} />{store.name}
              </label>)}
            </div>
            {!stores.length && <p style={{ margin: '8px 0 0', color: '#9F2F2D' }}>Không tải được Store của Owner hiện tại.</p>}
          </fieldset>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" disabled={busy} onClick={() => void approve(row.id)} style={{ padding: '9px 14px', border: 0, borderRadius: 7, background: '#364D39', color: '#FAF6F3', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Đang xử lý' : 'Duyệt & cấp quyền'}</button>
          <button type="button" disabled={busy} onClick={() => void reject(row.id)} style={{ padding: '9px 14px', border: '1px solid #D1DBD2', borderRadius: 7, background: '#FAF6F3', color: '#9F2F2D', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>Từ chối</button>
        </div>
      </article>;
    })}
  </section>;
}

export default function TenantJoinRequestsPage() {
  return <main style={{ maxWidth: 860, margin: '48px auto', padding: 24 }}><CanonicalTenantJoinRequestsPanel /></main>;
}
