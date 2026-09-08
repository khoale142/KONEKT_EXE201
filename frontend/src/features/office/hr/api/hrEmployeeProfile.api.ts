import api from "../../../../lib/http/axios";

export type HrEmployeeDocument = {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
};

export type HrEmployeeProfile = {
  id: number;
  fullName: string | null;
  username?: string | null;
  phone: string | null;
  email: string | null;
  employmentType: string | null;
  roleName: string | null;
  avatarUrl?: string | null;
  storeNames: string[];
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  permanentAddress?: string | null;
  currentAddress?: string | null;
  idCardNumber?: string | null;
  idCardIssueDate?: string | null;
  idCardIssuePlace?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  hourlyWage?: number | null;
  baseSalary?: number | null;
  documents?: HrEmployeeDocument[];
};

export const hrEmployeeProfileApi = {
  getEmployeeProfile: (storeId: number, employeeId: number) =>
    api
      .get<HrEmployeeProfile>(`/profile-update-request/store/employees/${employeeId}/profile`, {
        params: { storeId },
      })
      .then((response) => response.data),
};
