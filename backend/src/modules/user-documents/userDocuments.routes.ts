import { Router } from "express";
import multer from "multer";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import { saveUserDocumentMetadataSchema, uploadUserDocumentSchema } from "./userDocuments.schema";
import {
  getMyUserDocuments,
  getUserDocuments,
  handleSaveMyUserDocument,
  handleSaveUserDocument,
  handleUploadMyUserDocument,
  handleUploadUserDocument,
} from "./userDocuments.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authGuard, portalGuard(["OFFICE", "STORE"]));

router.get(
  "/me/documents",
  roleGuard(["staff", "shift_leader"]),
  asyncHandler(async (req, res) => {
    const result = await getMyUserDocuments({ reqUser: (req as any).user });
    res.json(result);
  })
);

router.post(
  "/me/documents",
  roleGuard(["staff", "shift_leader"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const parsed = uploadUserDocumentSchema.omit({ userId: true }).parse({
        documentType: req.body.documentType,
      });

      const result = await handleUploadMyUserDocument({
        reqUser: (req as any).user,
        documentType: parsed.documentType,
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });

      return res.json(result);
    }

    const parsed = saveUserDocumentMetadataSchema.omit({ userId: true }).parse({
      documentType: req.body.documentType,
      fileName: req.body.fileName,
      fileUrl: req.body.fileUrl,
      mimeType: req.body.mimeType,
    });

    const result = await handleSaveMyUserDocument({
      reqUser: (req as any).user,
      documentType: parsed.documentType,
      fileName: parsed.fileName,
      fileUrl: parsed.fileUrl,
      mimeType: parsed.mimeType,
    });

    res.json(result);
  })
);

router.get(
  "/:userId/documents",
  roleGuard(["admin", "district_manager", "store_manager"]),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const result = await getUserDocuments({ reqUser: (req as any).user, userId });
    res.json(result);
  })
);

router.post(
  "/:userId/documents",
  roleGuard(["admin", "district_manager", "store_manager"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const userIdParam = Number(req.params.userId);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const parsed = uploadUserDocumentSchema.parse({
        userId: userIdParam,
        documentType: req.body.documentType,
      });

      const result = await handleUploadUserDocument({
        reqUser: (req as any).user,
        userId: parsed.userId,
        documentType: parsed.documentType,
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });

      return res.json(result);
    }

    const parsed = saveUserDocumentMetadataSchema.parse({
      userId: userIdParam,
      documentType: req.body.documentType,
      fileName: req.body.fileName,
      fileUrl: req.body.fileUrl,
      mimeType: req.body.mimeType,
    });

    const result = await handleSaveUserDocument({
      reqUser: (req as any).user,
      userId: parsed.userId,
      documentType: parsed.documentType,
      fileName: parsed.fileName,
      fileUrl: parsed.fileUrl,
      mimeType: parsed.mimeType,
    });

    res.json(result);
  })
);

export default router;

