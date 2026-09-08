import { Router, Request, Response } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./profileUpdateRequest.service";

const router = Router();

router.use(authGuard);

/** Staff xem hồ sơ cá nhân và gửi yêu cầu chỉnh sửa */
router.get(
  "/me/profile",
  roleGuard(["staff", "shift_leader"]),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await service.getMyProfile({ reqUser: req.user });
    res.json(data);
  })
);

router.get(
  "/me/requests",
  roleGuard(["staff", "shift_leader"]),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await service.getMyRequests({ reqUser: req.user });
    res.json(data);
  })
);

router.post(
  "/me/requests",
  roleGuard(["staff", "shift_leader"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestedData } = req.body;
    const data = await service.createRequest({
      reqUser: req.user,
      requestedData: requestedData ?? {},
    });
    res.status(201).json(data);
  })
);

/** Manager xem hồ sơ nhân viên và quản lý yêu cầu */
router.get(
  "/store/employees/:employeeId/profile",
  roleGuard(["store_manager", "hr_manager", "admin"]),
  asyncHandler(async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    const employeeId = Number(req.params.employeeId);
    const data = await service.getEmployeeProfile({
      reqUser: req.user,
      storeId,
      employeeId,
    });
    res.json(data);
  })
);

router.get(
  "/store/requests",
  roleGuard(["store_manager"]),
  asyncHandler(async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    const status = req.query.status as string | undefined;
    const data = await service.listRequests({
      reqUser: req.user,
      storeId,
      status,
    });
    res.json(data);
  })
);

router.get(
  "/store/requests/:requestId",
  roleGuard(["store_manager"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const data = await service.getRequestDetail({
      reqUser: req.user,
      requestId,
    });
    res.json(data);
  })
);

router.post(
  "/store/requests/:requestId/approve",
  roleGuard(["store_manager"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const data = await service.approveRequest({
      reqUser: req.user,
      requestId,
    });
    res.json(data);
  })
);

router.post(
  "/store/requests/:requestId/reject",
  roleGuard(["store_manager"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const { rejectReason } = req.body ?? {};
    const data = await service.rejectRequest({
      reqUser: req.user,
      requestId,
      rejectReason: rejectReason ?? null,
    });
    res.json(data);
  })
);

/** HR xem/duyệt yêu cầu đã được Store Manager forward */
router.get(
  "/hr/requests",
  roleGuard(["hr_manager", "admin"]),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await service.listHrPendingRequests({ reqUser: req.user });
    res.json(data);
  })
);

router.get(
  "/hr/requests/:requestId",
  roleGuard(["hr_manager", "admin"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const data = await service.getRequestDetail({ reqUser: req.user, requestId });
    res.json(data);
  })
);

router.post(
  "/hr/requests/:requestId/approve",
  roleGuard(["hr_manager", "admin"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const data = await service.approveHrRequest({ reqUser: req.user, requestId });
    res.json(data);
  })
);

router.post(
  "/hr/requests/:requestId/reject",
  roleGuard(["hr_manager", "admin"]),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    const { rejectReason } = req.body ?? {};
    const data = await service.rejectHrRequest({ reqUser: req.user, requestId, rejectReason: rejectReason ?? null });
    res.json(data);
  })
);

export default router;
