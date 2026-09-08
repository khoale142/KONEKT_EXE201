import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  marketingContentAdminListQuerySchema,
  marketingContentBodySchema,
  marketingContentFeatureBodySchema,
  marketingContentHomeQuerySchema,
  marketingContentIdParamSchema,
  marketingContentPublicListQuerySchema,
  marketingContentSlugParamSchema,
  marketingContentStatusBodySchema,
  marketingContentToggleActiveBodySchema,
} from "./marketingContents.schema";
import {
  createMarketingContent,
  deleteMarketingContent,
  getMarketingContentDetail,
  getPublicHomeMarketingContents,
  getPublicMarketingContentDetail,
  listMarketingContents,
  listPublicMarketingContents,
  toggleMarketingContentActive,
  updateMarketingContent,
  updateMarketingContentFeature,
  updateMarketingContentStatus,
} from "./marketingContents.service";

function getActorUserId(req: Request): number | null {
  return req.user?.sub ? Number(req.user.sub) : null;
}

export const postMarketingContent = asyncHandler(async (req: Request, res: Response) => {
  const body = marketingContentBodySchema.parse(req.body || {});
  const data = await createMarketingContent(body, getActorUserId(req));
  res.status(201).json({ data });
});

export const getMarketingContentList = asyncHandler(async (req: Request, res: Response) => {
  const query = marketingContentAdminListQuerySchema.parse(req.query || {});
  const data = await listMarketingContents(query);
  res.json({ data });
});

export const getMarketingContentById = asyncHandler(async (req: Request, res: Response) => {
  const params = marketingContentIdParamSchema.parse(req.params);
  const data = await getMarketingContentDetail(params.id);
  res.json({ data });
});

export const putMarketingContent = asyncHandler(async (req: Request, res: Response) => {
  const params = marketingContentIdParamSchema.parse(req.params);
  const body = marketingContentBodySchema.parse(req.body || {});
  const data = await updateMarketingContent(params.id, body, getActorUserId(req));
  res.json({ data });
});

export const patchMarketingContentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const params = marketingContentIdParamSchema.parse(req.params);
    const body = marketingContentStatusBodySchema.parse(req.body || {});
    const data = await updateMarketingContentStatus({
      id: params.id,
      status: body.status,
      publishedAt: body.publishedAt,
      actorUserId: getActorUserId(req),
    });
    res.json({ data });
  },
);

export const patchMarketingContentToggleActive = asyncHandler(
  async (req: Request, res: Response) => {
    const params = marketingContentIdParamSchema.parse(req.params);
    const body = marketingContentToggleActiveBodySchema.parse(req.body || {});
    const data = await toggleMarketingContentActive({
      id: params.id,
      isActive: body.isActive,
      actorUserId: getActorUserId(req),
    });
    res.json({ data });
  },
);

export const patchMarketingContentFeature = asyncHandler(
  async (req: Request, res: Response) => {
    const params = marketingContentIdParamSchema.parse(req.params);
    const body = marketingContentFeatureBodySchema.parse(req.body || {});
    const data = await updateMarketingContentFeature({
      id: params.id,
      isFeatured: body.isFeatured,
      sortOrder: body.sortOrder,
      actorUserId: getActorUserId(req),
    });
    res.json({ data });
  },
);

export const deleteMarketingContentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const params = marketingContentIdParamSchema.parse(req.params);
    const data = await deleteMarketingContent(params.id, getActorUserId(req));
    res.json({ data });
  },
);

export const getPublicMarketingContentList = asyncHandler(
  async (req: Request, res: Response) => {
    const query = marketingContentPublicListQuerySchema.parse(req.query || {});
    const data = await listPublicMarketingContents(query);
    res.json({ data });
  },
);

export const getPublicMarketingContentBySlug = asyncHandler(
  async (req: Request, res: Response) => {
    const params = marketingContentSlugParamSchema.parse(req.params);
    const data = await getPublicMarketingContentDetail(params.slug);
    res.json({ data });
  },
);

export const getPublicHomeMarketingContentGroups = asyncHandler(
  async (req: Request, res: Response) => {
    const query = marketingContentHomeQuerySchema.parse(req.query || {});
    const data = await getPublicHomeMarketingContents(query);
    res.json({ data });
  },
);
