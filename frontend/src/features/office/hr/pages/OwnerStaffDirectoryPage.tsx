import { useEffect, useState } from 'react';
import { workspaceApi, StaffDirectoryItem, WorkspaceStore } from '../../../workspace/api/workspace.api';
import { useAuthStore } from '../../../../app/store/auth.store';
const roles: Record<string, string> = { staff: 'Nhân viên', shift_leader: 'Trưởng ca', store_manager: 'Quản lý cửa hàng' };

export default function OwnerStaffDirectoryPage() {
  const tenantId = useAuthStore(s => s.user?.tenantId);
  const [rows, setRows] = useState<StaffDirectoryItem[]>([]);
  const [stores, setStores] = useState<WorkspaceStore[]>([]);
  const [storeId, setStoreId] = useState<number>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setPage(1); setStoreId(undefined); setRows([]); workspaceApi.getOwnerStores().then(setStores).catch(() => setStores([])); }, [tenantId]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    workspaceApi.listStaff({ page, search, storeId }).then(data => { if (active) { setRows(data.items); setTotal(data.total); } }).catch(() => { if (active) setError('Không tải được danh sách nhân sự.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, page, search, storeId, version]);
  return <section style={{ color: '#364D39' }}>
    <h2>Danh sách nhân sự</h2><p>Nhân viên đã được phân công vào các chi nhánh của thương hiệu.</p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <input aria-label="Tìm nhân viên" placeholder="Tìm theo tên hoặc email" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ padding: 12 }} />
      <select aria-label="Lọc theo chi nhánh" value={storeId ?? ''} onChange={e => { setStoreId(Number(e.target.value) || undefined); setPage(1); }}><option value="">Tất cả chi nhánh</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button onClick={() => setVersion(v => v + 1)}>Tải lại</button>
    </div>
    {error ? <p role="alert">{error}</p> : loading ? <p role="status">Đang tải nhân sự…</p> : !rows.length ? <p>Chưa có nhân viên phù hợp. Nhân viên sẽ xuất hiện tại đây sau khi được duyệt.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr>{['Nhân viên', 'Liên hệ', 'Chi nhánh', 'Vai trò', 'Trạng thái'].map(h => <th key={h} style={{ padding: 12, borderBottom: '1px solid #E8E0D5' }}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id}>{[r.fullName || r.email, r.email + (r.phone ? ' · ' + r.phone : ''), r.storeName || 'Chưa phân công', roles[r.role] || r.role, r.isActive ? 'Đang hoạt động' : 'Tạm khóa'].map((v, i) => <td key={i} style={{ padding: 12, borderBottom: '1px solid #E8E0D5' }}>{v}</td>)}</tr>)}</tbody></table></div>}
    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page} · {total} nhân viên</span><button disabled={page * 20 >= total || loading} onClick={() => setPage(p => p + 1)}>Sau</button></div>
  </section>;
}
