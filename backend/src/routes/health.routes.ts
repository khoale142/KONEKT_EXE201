import { Router } from "express";
import { dbPing } from "../config/db";

const router = Router();

router.get("/", async (_req, res) => {
  const ok = await dbPing();
  res.json({ ok });
});

export default router;