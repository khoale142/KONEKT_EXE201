import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workspaceApi, type PendingStoreRequest, type VerifiedStoreInvite } from '../api/workspace.api';

export default function TenantJoinPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [verifiedStore, setVerifiedStore] = useState<VerifiedStoreInvite | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingStoreRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  // Account-scope sessions can read their own pending requests. This makes the
  // waiting state durable across refreshes without granting a workspace.
  useEffect(() => {
    let active = true;
    void workspaceApi.getWorkspaces()
      .then((data) => {
        if (active) setPendingRequest(data.pendingRequests.find((request) => request.status === 'pending') ?? null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const verify = async () => {
    if (!inviteCode.trim()) return;
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      setVerifiedStore(await workspaceApi.verifyStoreInvite(inviteCode));
    } catch (e: any) {
      setVerifiedStore(null);
      setError(e?.response?.data?.message || 'Không thể xác minh mã mời cửa hàng.');
    } finally {
      setVerifying(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verifiedStore) {
      setError('Hãy kiểm tra mã mời cửa hàng trước khi tham gia.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await workspaceApi.submitCanonicalStoreJoinRequest(inviteCode);
      setPendingRequest({
        id: result.request.id,
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        storeId: result.store.id,
        storeName: result.store.name,
        status: result.request.status,
        createdAt: result.request.createdAt,
      });
      setMessage(result.alreadyPending ? 'Yêu cầu tham gia này đang chờ chủ doanh nghiệp duyệt.' : 'Yêu cầu tham gia đã được gửi.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể gửi yêu cầu tham gia cửa hàng.');
    } finally {
      setSaving(false);
    }
  };

  return <main style={{ maxWidth: 560, margin: '64px auto', padding: 24, color: '#2A3B2C' }}>
    <h1>Tham gia cửa hàng</h1>
    <p>Nhập mã mời do cửa hàng cung cấp. Chủ doanh nghiệp sẽ duyệt vai trò và các cửa hàng bạn được phép làm việc.</p>
    {pendingRequest && <section style={{ marginTop: 20, padding: 16, border: '1px solid #D9B86B', borderRadius: 8, background: '#FFFBEB' }}>
      <strong>Yêu cầu tham gia đã được gửi</strong>
      <p style={{ margin: '8px 0 0' }}><strong>Doanh nghiệp:</strong> {pendingRequest.tenantName}</p>
      <p style={{ margin: '4px 0 0' }}><strong>Cửa hàng được mời:</strong> {pendingRequest.storeName || 'Đang xác định'}</p>
      <p style={{ margin: '8px 0 0', color: '#78350F' }}>Đang chờ chủ doanh nghiệp duyệt</p>
    </section>}
    <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 28 }}>
      <label>Mã mời cửa hàng
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input placeholder="KN-19-..." value={inviteCode} onChange={(event) => { setInviteCode(event.target.value.toUpperCase()); setVerifiedStore(null); }} required maxLength={50} style={{ flex: 1, minWidth: 0, padding: 12, boxSizing: 'border-box' }} />
          <button type="button" onClick={() => void verify()} disabled={verifying || !inviteCode.trim()} style={{ padding: '12px 14px', background: '#F4EFEB', color: '#364D39', border: '1px solid #D1DBD2', borderRadius: 6 }}>{verifying ? 'Đang kiểm tra' : 'Kiểm tra'}</button>
        </div>
      </label>
      {verifiedStore && <section style={{ padding: 14, border: '1px solid #C4D6C6', borderRadius: 8, background: '#F4EFEB' }}>
        <strong>{verifiedStore.storeName}</strong>
        <p style={{ margin: '6px 0 0' }}><strong>Doanh nghiệp:</strong> {verifiedStore.tenantName}</p>
        <p style={{ margin: '6px 0 0' }}>{verifiedStore.storeAddress || 'Cửa hàng đã sẵn sàng để nhận yêu cầu của bạn.'}</p>
      </section>}
      <button disabled={saving || !verifiedStore} style={{ padding: 12, background: '#364D39', color: '#FAF6F3', border: 0, borderRadius: 6 }}>{saving ? 'Đang gửi yêu cầu' : 'Gửi yêu cầu tham gia'}</button>
    </form>
    {message && <p style={{ marginTop: 18, color: '#346538' }}>{message}</p>}
    {error && <p style={{ marginTop: 18, color: '#9F2F2D' }}>{error}</p>}
    <p style={{ marginTop: 24 }}><Link to="/workspace/select-tenant">Quay lại</Link></p>
  </main>;
}
