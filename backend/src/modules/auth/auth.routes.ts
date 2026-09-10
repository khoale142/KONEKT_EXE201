import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { ticketUpload } from "../../config/upload";
import {
  loginStore,
  loginOffice,
  loginPos,
  customerLogin,
  customerRegisterMembership,
  refresh,
  me,
  customerSendOtp,
  customerVerifyOtpAndRegister,
  customerSendResetOtp,
  customerVerifyResetOtp,
  customerResetPassword,
  storeSendResetOtp,
  storeVerifyResetOtp,
  storeResetPassword,
  officeSendResetOtp,
  officeVerifyResetOtp,
  officeResetPassword,
  customerChangePassword,
  customerCompleteAccountSendOtp,
  customerCompleteAccountVerifyOtp,
  customerCompleteAccountFinish,
} from "./auth.controller";
import {
  meCustomerProfile,
  updateMeCustomerProfile,
  createTicketHandler,
  getMyTicketsHandler,
} from "../members/members.controller";
import {
  customerTicketDetailHandler,
  customerReplyHandler,
} from "../head-officer/head-officer.controller";

const router = Router();

router.post("/login/store", loginStore);
router.post("/login/office", loginOffice);
router.post("/login/pos", loginPos);
router.post("/login/customer", customerLogin);

// CUSTOMER register membership (với OTP)
router.post("/customer/send-otp", customerSendOtp);
router.post("/customer/verify-otp", customerVerifyOtpAndRegister);
router.post("/customer/register-membership", customerRegisterMembership);

// CUSTOMER profile (GET/PUT me) - requires CUSTOMER portal
router.get("/customer/me", authGuard, portalGuard(["CUSTOMER"]), meCustomerProfile);
router.put("/customer/me", authGuard, portalGuard(["CUSTOMER"]), updateMeCustomerProfile);

// CUSTOMER support tickets
router.get("/customer/tickets", authGuard, portalGuard(["CUSTOMER"]), getMyTicketsHandler);
router.post("/customer/tickets", authGuard, portalGuard(["CUSTOMER"]), ticketUpload.single("attachment"), createTicketHandler);
// CUSTOMER ticket detail + chat
router.get("/customer/tickets/:id", authGuard, portalGuard(["CUSTOMER"]), customerTicketDetailHandler);
router.post("/customer/tickets/:id/messages", authGuard, portalGuard(["CUSTOMER"]), customerReplyHandler);

router.post(
  "/customer/change-password",
  authGuard,
  portalGuard(["CUSTOMER"]),
  customerChangePassword
);

router.post(
  "/customer/complete-account/send-otp",
  authGuard,
  portalGuard(["CUSTOMER"]),
  customerCompleteAccountSendOtp
);

router.post(
  "/customer/complete-account/verify-otp",
  authGuard,
  portalGuard(["CUSTOMER"]),
  customerCompleteAccountVerifyOtp
);

router.post(
  "/customer/complete-account/finish",
  authGuard,
  portalGuard(["CUSTOMER"]),
  customerCompleteAccountFinish
);

// CUSTOMER forgot password (public)
router.post("/customer/send-reset-otp", customerSendResetOtp);
router.post("/customer/verify-reset-otp", customerVerifyResetOtp);
router.post("/customer/reset-password", customerResetPassword);

// STORE forgot password (public, excludes POS)
router.post("/store/send-reset-otp", storeSendResetOtp);
router.post("/store/verify-reset-otp", storeVerifyResetOtp);
router.post("/store/reset-password", storeResetPassword);

// OFFICE forgot password (public)
router.post("/office/send-reset-otp", officeSendResetOtp);
router.post("/office/verify-reset-otp", officeVerifyResetOtp);
router.post("/office/reset-password", officeResetPassword);

// refresh + me
router.post("/refresh", refresh);
router.get("/me", authGuard, me);

// ── KONEKT Multi-Tenant Endpoints ──
import {
  registerOwnerHandler,
  registerStaffHandler,
  loginKonektHandler,
  demoLoginHandler,
} from "./auth.controller";

router.post("/register-owner", registerOwnerHandler);
router.post("/register-staff", registerStaffHandler);
router.post("/login-konekt", loginKonektHandler);
router.post("/demo-login", demoLoginHandler);

export default router;

