import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { workspaceApi, WorkspaceStore } from '../../../workspace/api/workspace.api';
import { useAuthStore } from '../../../../app/store/auth.store';

export default function StoreInvitePanel() {
  const tenantId = useAuthStore(s => s.user?.tenantId);
  const tenantName = useAuthStore(s => s.user?.tenantName);
  const [stores, setStores] = useState<WorkspaceStore[]>([]);
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setBusy(true); setError(''); setCopied(false);
    try {
      const rows = await workspaceApi.getOwnerStores();
      setStores(rows);
      setSelected(id => rows.some(s => s.id === id) ? id : rows[0]?.id);
    } catch { setError('Không tải được mã mời. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { setStores([]); setSelected(undefined); void load(); }, [tenantId]);
  const store = stores.find(s => s.id === selected);
  const copy = async () => {
    try { await navigator.clipboard.writeText(store!.inviteCode!); setCopied(true); setError(''); }
    catch { setError('Không thể sao chép tự động. Hãy chọn và sao chép mã bên dưới.'); }
  };
  const issue = async () => {
    if (!store) return;
    setBusy(true); setError('');
    try { const row = await workspaceApi.ensureInvite(store.id); setStores(prev => prev.map(s => s.id === row.id ? row : s)); }
    catch { setError('Chưa cấp được mã mời. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Mời nhân viên" style={{ background: '#F4EFEB', border: '1px solid #E8E0D5', padding: 24, borderRadius: 12, marginBottom: 20, color: '#364D39' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: '0 0 8px', fontSize: 20 }}><Store size={20} /> Mời nhân viên vào cửa hàng</h2><p style={{ margin: 0 }}>{tenantName} · Chọn chi nhánh và gửi mã này cho nhân viên.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} aria-label="Tải lại mã mời"><RefreshCw size={18} /></button>
    </div>
    {busy && !stores.length ? <p role="status">Đang tải chi nhánh…</p> : stores.length ? <div style={{ display: 'flex', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
      <label style={{ display: 'grid', gap: 8 }}>Chi nhánh<select aria-label="Chi nhánh nhận nhân viên" value={selected ?? ''} onChange={e => { setSelected(Number(e.target.value)); setCopied(false); }} style={{ padding: 12, borderRadius: 8, maxWidth: '100%' }}>{stores.map(s => <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (Tạm ngừng)' : ''}</option>)}</select></label>
      {store?.inviteCode ? <><div><small>Mã mời cửa hàng</small><div style={{ fontFamily: 'monospace', fontSize: 19, overflowWrap: 'anywhere', paddingTop: 8, userSelect: 'all' }}>{store.inviteCode}</div></div><button type="button" disabled={!store.isActive} onClick={() => void copy()} style={{ padding: '12px 16px', background: '#364D39', color: '#FAF6F3', border: 0, borderRadius: 8 }}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Đã sao chép' : 'Sao chép mã'}</button></> : <button type="button" disabled={busy || !store?.isActive} onClick={() => void issue()}>Cấp mã mời</button>}
    </div> : !error && <p>Chưa có chi nhánh. <Link to="/workspace/select-store">Tạo chi nhánh</Link></p>}
    <p style={{ fontSize: 13, marginBottom: 0 }}>Gửi mã này cho nhân viên. Sau khi đăng ký tài khoản và nhập mã, nhân viên sẽ được thêm vào cửa hàng với vai trò Staff.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
