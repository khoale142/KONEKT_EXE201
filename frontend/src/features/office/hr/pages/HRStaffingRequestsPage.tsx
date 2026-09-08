import HRRequestFlowPage from "./HRRequestFlowWorkspacePage";

export default function HRStaffingRequestsPage() {
  return (
    <HRRequestFlowPage
      allowedTypes={["hire", "fire"]}
      title="Luồng duyệt tuyển / sa thải nhân sự"
      subtitle="Chỉ hiển thị yêu cầu tuyển mới và nghỉ việc để HR xử lý tập trung."
      emptyText="Không có yêu cầu tuyển / sa thải nhân sự nào."
    />
  );
}
