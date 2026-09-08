import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function getTodayHcmYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function isAtLeast18YearsOld(dateOfBirth: string): boolean {
  const today = new Date(`${getTodayHcmYmd()}T00:00:00+07:00`);
  const dob = new Date(`${dateOfBirth}T00:00:00+07:00`);
  if (Number.isNaN(today.getTime()) || Number.isNaN(dob.getTime())) return false;

  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = today.getUTCDate() - dob.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 18;
}

export const listStoreManagerStaffQuerySchema = z.object({
  storeId: z
    .coerce
    .number()
    .int()
    .positive()
    .optional(),
  q: z.string().trim().max(200).optional(),
  role: z.enum(["staff", "shift_leader"]).optional(),
  status: z.enum(["active", "inactive", "terminated"]).optional(),
});

/** Schema thêm nhân sự - camelCase map trực tiếp DB: full_name, date_of_birth, id_card_number, ... */
export const createStaffSchema = z.object({
  fullName: z.string().trim().min(1, "Họ tên không được để trống").max(200),
  email: z.string().trim().email("Email không hợp lệ").max(200),
  phone: z.string().trim().regex(/^\d{10}$/, "Số điện thoại phải gồm đúng 10 chữ số"),
  role: z.literal("staff"),
  hireDate: z.string().regex(dateRegex, "Ngày vào làm phải ở định dạng YYYY-MM-DD").optional(),
  employmentType: z.enum(["full_time", "part_time"]),

  dateOfBirth: z
    .string()
    .regex(dateRegex, "Ngày sinh phải ở định dạng YYYY-MM-DD")
    .refine((v) => {
      const todayYMD = getTodayHcmYmd();
      return v <= todayYMD;
    }, "Ngày sinh không được ở tương lai")
    .refine((v) => isAtLeast18YearsOld(v), "Nhân viên phải từ đủ 18 tuổi trở lên"),
  address: z.string().trim().min(1, "Địa chỉ không được để trống").max(500),
  idCardNumber: z.string().trim().regex(/^\d+$/, "CCCD / CMND phải là chuỗi số").max(20),
  emergencyContactName: z.string().trim().min(1, "Người liên hệ khẩn cấp không được để trống").max(200),
  emergencyContactPhone: z.string().trim().regex(/^\d{10}$/, "Số điện thoại liên hệ khẩn cấp phải gồm đúng 10 chữ số"),

  avatarUrl: z.string().trim().max(2000).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.fullName.trim().toLocaleLowerCase("vi") === data.emergencyContactName.trim().toLocaleLowerCase("vi")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactName"],
      message: "Người liên hệ khẩn cấp không được trùng họ tên nhân viên",
    });
  }
  if (data.phone.trim() === data.emergencyContactPhone.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactPhone"],
      message: "Số điện thoại khẩn cấp không được trùng số điện thoại nhân viên",
    });
  }
});

export const terminateStaffBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// Submit request tuyển dụng (hire) để Office/HR duyệt
// Reuse createStaffSchema để FE gửi cùng format fields như màn hình tạo nhân sự.
export const submitHireStaffRequestBodySchema = createStaffSchema;

// Submit request sa thải (fire) để Office/HR duyệt
export const submitFireStaffRequestBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
  // Dùng để hiển thị nhanh trên HR requests page.
  position: z.string().trim().max(200).optional(),
  targetRole: z.string().trim().max(50).optional(),
  targetHireDate: z
    .string()
    .regex(dateRegex)
    .optional()
    .nullable(),
});

export const submitStaffUpdateRequestBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
    managerExperienceNote: z.string().trim().max(1000).optional(),
    targetRole: z.literal("shift_leader").optional(),
    targetEmploymentType: z.literal("full_time").optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.targetRole && !data.targetEmploymentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn ít nhất một thay đổi cần gửi HR duyệt",
      });
    }
  });

export const updateStaffAvatarBodySchema = z.object({
  avatarUrl: z.string().trim().max(2000).optional().nullable(),
});

