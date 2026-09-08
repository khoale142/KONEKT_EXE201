import { z } from "zod";

// username min(3): tài khoản nhân sự auto-gen dạng staff1, staff2,... (luôn >= 5 ký tự).
// Không dùng username thuần số (vd: "6") vì 1 ký tự < min(3) -> Zod reject trước khi tới auth.
export const staffLoginSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
  password: z.string().min(6),
});

export const storeBranchSchema = z.enum(["manager", "staff"]);

export const storeLoginSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
  password: z.string().min(6),
  branch: storeBranchSchema,
});

export const officeBranchSchema = z.enum(["audit", "dm", "marketing", "hr"]);

export const officeLoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  branch: officeBranchSchema,
});

export const customerLoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(6),
});

export const customerChangePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const customerCompleteAccountSendOtpSchema = z.object({
  email: z.string().email(),
});

export const customerCompleteAccountVerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});

export const customerCompleteAccountFinishSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const customerRegisterSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^[0-9]{10}$/, "Số điện thoại phải gồm đúng 10 chữ số"),
  email: z.string().email(),
  password: z.string().min(6),
  gender: z.enum(["male", "female", "other"]),
  birthday: z.string().min(1),
  city: z.string().min(1),
});

export const customerUpdateProfileSchema = z.object({
  fullName: z.string().min(1).max(255),
  phone: z.string().regex(/^[0-9]{10}$/, "Số điện thoại phải gồm đúng 10 chữ số"),
  gender: z.enum(["male", "female", "other"]),
  birthday: z.string().min(1),
  city: z.string().min(1),
});

export const sendOtpSchema = z.object({ email: z.string().email() });

export const verifyRegisterOtpSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^[0-9]{10}$/),
  email: z.string().email(),
  password: z.string().min(6),
  otp: z.string().min(4).max(8),
  gender: z.enum(["male", "female", "other"]),
  birthday: z.string().min(1),
  city: z.string().min(1),
});

export const sendResetOtpSchema = z.object({ email: z.string().email() });

export const verifyResetOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});