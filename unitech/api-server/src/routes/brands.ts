import { Router, type IRouter } from "express";
import { db, brandsTable, phoneModelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/brands", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(brandsTable).orderBy(brandsTable.name);
  res.json(rows);
});

router.post("/brands", requireAuth, async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [brand] = await db.insert(brandsTable).values({ name }).returning();
  res.status(201).json(brand);
});

router.patch("/brands/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [brand] = await db.update(brandsTable).set({ name }).where(eq(brandsTable.id, id)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(brand);
});

router.delete("/brands/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(brandsTable).where(eq(brandsTable.id, id));
  res.json({ message: "Brand deleted" });
});

// Phone Models
router.get("/models", requireAuth, async (req, res): Promise<void> => {
  const brandIdRaw = req.query.brandId;
  const brandId = brandIdRaw ? parseInt(String(brandIdRaw), 10) : null;

  const rows = await db
    .select({
      id: phoneModelsTable.id,
      name: phoneModelsTable.name,
      brandId: phoneModelsTable.brandId,
      brandName: brandsTable.name,
    })
    .from(phoneModelsTable)
    .leftJoin(brandsTable, eq(phoneModelsTable.brandId, brandsTable.id))
    .where(brandId ? eq(phoneModelsTable.brandId, brandId) : undefined)
    .orderBy(phoneModelsTable.name);
  res.json(rows);
});

router.post("/models", requireAuth, async (req, res): Promise<void> => {
  const { name, brandId } = req.body;
  if (!name || !brandId) {
    res.status(400).json({ error: "Name and brandId are required" });
    return;
  }
  const [model] = await db
    .insert(phoneModelsTable)
    .values({ name, brandId: parseInt(brandId, 10) })
    .returning();
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, model.brandId));
  res.status(201).json({ ...model, brandName: brand?.name ?? null });
});

router.patch("/models/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, brandId } = req.body;
  if (!name || !brandId) {
    res.status(400).json({ error: "Name and brandId are required" });
    return;
  }
  const [model] = await db
    .update(phoneModelsTable)
    .set({ name, brandId: parseInt(brandId, 10) })
    .where(eq(phoneModelsTable.id, id))
    .returning();
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, model.brandId));
  res.json({ ...model, brandName: brand?.name ?? null });
});

router.delete("/models/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(phoneModelsTable).where(eq(phoneModelsTable.id, id));
  res.json({ message: "Model deleted" });
});

export default router;
