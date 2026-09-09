import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "../../utils/jwt";
import {
  storeLoginSchema,
  officeLoginSchema,
  staffLoginSchema,
  customerLoginSchema,
  customerRegisterSchema,
  sendOtpSchema,
  verifyRegisterOtpSchema,
  sendResetOtpSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  customerChangePasswordSchema,
  customerCompleteAccountSendOtpSchema,
  customerCompleteAccountVerifyOtpSchema,
  customerCompleteAccountFinishSchema,
} from "./auth.schema";
import {
  loginStoreByBranch,
  loginOfficeByBranch,
  loginPos as loginPosService,
  loginCustomer,
  registerMembership,
  sendRegisterOtp,
  verifyRegisterOtpAndCreate,
  sendResetOtp,
  verifyResetOtp,
  resetPassword,
  sendUserResetOtp,
  verifyUserResetOtp,
  resetUserPassword,
  changeCustomerPassword,
  sendCompleteAccountOtp,
  verifyCompleteAccountOtp,
  completeCustomerAccount,
} from "./auth.service";

export const loginStore = asyncHandler(async (req: Request, res: Response) => {
  const body = storeLoginSchema.parse(req.body);
  const result = await loginStoreByBranch({
    username: body.username,
    password: body.password,
    branch: body.branch,
  });
  res.json(result);
});

export const loginOffice = asyncHandler(async (req: Request, res: Response) => {
  const body = officeLoginSchema.parse(req.body);
  const result = await loginOfficeByBranch({
    username: body.username,
    password: body.password,
    branch: body.branch,
  });
  res.json(result);
});

export const loginPos = asyncHandler(async (req: Request, res: Response) => {
  const body = staffLoginSchema.parse(req.body);
  const result = await loginPosService({
    username: body.username,
    password: body.password,
  });
  res.json(result);
});

export const customerLogin = asyncHandler(async (req: Request, res: Response) => {
  const body = customerLoginSchema.parse(req.body);
  const result = await loginCustomer({
    identifier: body.identifier,
    password: body.password,
  });
  res.json(result);
});

export const customerRegisterMembership = asyncHandler(
  async (req: Request, res: Response) => {
    const body = customerRegisterSchema.parse(req.body);
    const fullName = `${body.firstName.trim()} ${body.lastName.trim()}`.trim();

    const result = await registerMembership({
      fullName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      gender: body.gender,
      birthday: body.birthday,
      city: body.city,
    });

    res.status(201).json(result);
  }
);

export const customerChangePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = Number((req as any).user.sub);
    const body = customerChangePasswordSchema.parse(req.body);

    const result = await changeCustomerPassword({
      customerId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    res.json(result);
  }
);

export const customerCompleteAccountSendOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = Number((req as any).user.sub);
    const { email } = customerCompleteAccountSendOtpSchema.parse(req.body);
    const result = await sendCompleteAccountOtp(customerId, email);
    res.json(result);
  }
);

export const customerCompleteAccountVerifyOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = Number((req as any).user.sub);
    const { email, otp } = customerCompleteAccountVerifyOtpSchema.parse(req.body);
    const result = await verifyCompleteAccountOtp(customerId, email, otp);
    res.json(result);
  }
);

export const customerCompleteAccountFinish = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = Number((req as any).user.sub);
    const body = customerCompleteAccountFinishSchema.parse(req.body);

    const result = await completeCustomerAccount({
      customerId,
      email: body.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    res.json(result);
  }
);

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body?.refreshToken;
  if (!token) throw new ApiError(400, "Missing refreshToken");

  const claims = verifyRefreshToken(token);
  const newAccess = signAccessToken(claims);
  const newRefresh = signRefreshToken(claims);

  res.json({ accessToken: newAccess, refreshToken: newRefresh });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

export const customerSendOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = sendOtpSchema.parse(req.body);
    const result = await sendRegisterOtp(email);
    res.json(result);
  }
);

export const customerVerifyOtpAndRegister = asyncHandler(
  async (req: Request, res: Response) => {
    const body = verifyRegisterOtpSchema.parse(req.body);
    const result = await verifyRegisterOtpAndCreate(body);
    res.status(201).json(result);
  }
);

export const customerSendResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = sendResetOtpSchema.parse(req.body);
    const result = await sendResetOtp(email);
    res.json(result);
  }
);

export const customerVerifyResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = verifyResetOtpSchema.parse(req.body);
    const result = await verifyResetOtp(email, otp);
    res.json(result);
  }
);

export const customerResetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = resetPasswordSchema.parse(req.body);
    const result = await resetPassword(email, password);
    res.json(result);
  }
);

export const storeSendResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = sendResetOtpSchema.parse(req.body);
    const result = await sendUserResetOtp("STORE", email);
    res.json(result);
  }
);

export const storeVerifyResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = verifyResetOtpSchema.parse(req.body);
    const result = await verifyUserResetOtp("STORE", email, otp);
    res.json(result);
  }
);

export const storeResetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = resetPasswordSchema.parse(req.body);
    const result = await resetUserPassword("STORE", email, password);
    res.json(result);
  }
);

export const officeSendResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = sendResetOtpSchema.parse(req.body);
    const result = await sendUserResetOtp("OFFICE", email);
    res.json(result);
  }
);

export const officeVerifyResetOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = verifyResetOtpSchema.parse(req.body);
    const result = await verifyUserResetOtp("OFFICE", email, otp);
    res.json(result);
  }
);

export const officeResetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = resetPasswordSchema.parse(req.body);
    const result = await resetUserPassword("OFFICE", email, password);
    res.json(result);
  }
);

// ── KONEKT Multi-Tenant Endpoints ──
import {
  registerOwner,
  loginKonekt as loginKonektService,
  demoLogin as demoLoginService,
} from "./konektAuth.service";

export const registerOwnerHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { brandName, fullName, email, password, phone, address } = req.body;
    const result = await registerOwner({
      brandName,
      fullName,
      email,
      password,
      phone,
      address,
    });
    res.status(201).json(result);
  }
);

export const loginKonektHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      throw new ApiError(400, "Vui lòng nhập tài khoản và mật khẩu");
    }
    const result = await loginKonektService(identifier, password);
    res.json(result);
  }
);

export const demoLoginHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = (req.body.role || "owner") as "owner" | "manager" | "staff";
    const result = await demoLoginService(role);
    res.json(result);
  }
);

