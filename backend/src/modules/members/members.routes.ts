import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import { pool } from "../../config/db";
import { hashPassword } from "../../utils/password";
import { ApiError } from "../../utils/apiError";
import { safeWritePosActionLog } from "../pos-action-log/posActionLog.service";

const router = Router();
router.use(authGuard, portalGuard(["POS"]));

router.get(
  "/find",
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone || "").trim();
    if (phone.length < 8) return res.status(400).json({ message: "Phone invalid" });

    const r = await pool.query(
      `SELECT id, full_name, points
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [phone]
    );

    if (!r.rows[0]) return res.json({ member: null });

    res.json({
      member: {
        id: Number(r.rows[0].id),
        fullName: String(r.rows[0].full_name || ""),
        points: Number(r.rows[0].points || 0),
      },
    });
  })
);

router.post(
  "/quick-create",
  asyncHandler(async (req, res) => {
    const fullName = String(req.body.fullName || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (!fullName) {
      throw new ApiError(400, "Tên khách không được để trống");
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      throw new ApiError(400, "Số điện thoại phải gồm đúng 10 chữ số");
    }

    const existed = await pool.query(
      `SELECT id, full_name, points
       FROM customers
       WHERE phone = $1
       LIMIT 1`,
      [phone]
    );

    if (existed.rows[0]) {
      throw new ApiError(409, "Số điện thoại đã tồn tại");
    }

    const passwordHash = await hashPassword("123456");

    const created = await pool.query(
      `
      INSERT INTO customers(
        email,
        phone,
        full_name,
        password_hash,
        points,
        level,
        is_active,
        must_change_password,
        gender
      )
      VALUES (NULL, $1, $2, $3, 0, 'Member', TRUE, TRUE, 'other')
      RETURNING id, full_name, points
      `,
      [phone, fullName, passwordHash]
    );

    const storeId = Number((req as any).user?.storeId || 0);

    if (storeId > 0) {
      await safeWritePosActionLog({
        storeId,
        reqUser: (req as any).user,
        actionType: "MEMBER_QUICK_CREATE",
        entityType: "MEMBER",
        entityId: Number(created.rows[0].id),
        memberId: Number(created.rows[0].id),
        note: "Tao member nhanh tai POS",
        afterData: {
          memberId: Number(created.rows[0].id),
          fullName: String(created.rows[0].full_name || ""),
          phone,
          tempPassword: "123456",
          mustChangePassword: true,
          requiresEmailSetup: true,
        },
      });
    } else {
      console.warn("Skip MEMBER_QUICK_CREATE log because storeId missing in token");
    }

    res.status(201).json({
      member: {
        id: Number(created.rows[0].id),
        fullName: String(created.rows[0].full_name || ""),
        points: Number(created.rows[0].points || 0),
      },
      tempPassword: "123456",
      mustChangePassword: true,
      requiresEmailSetup: true,
    });
  })
);

export default router;