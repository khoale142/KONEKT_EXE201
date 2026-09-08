import HRRequestFlowPage from "./HRRequestFlowWorkspacePage";

export default function HRRoleUpdateRequestsPage() {
  return (
    <HRRequestFlowPage
      allowedTypes={["staff_update"]}
      title="Luồng cập nhật vai trò"
      subtitle="Chỉ hiển thị yêu cầu chuyển staff lên Shift Leader hoặc chuyển sang toàn thời gian."
      emptyText="Không có yêu cầu cập nhật vai trò nào."
    />
  );
}
