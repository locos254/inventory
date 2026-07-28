import { Router, type IRouter } from "express";
import { db, screenTypesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/screen-types", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(screenTypesTable).orderBy(screenTypesTable.name);
  res.json(rows);
});

router.post("/screen-types", requireAuth, async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [st] = await db.insert(screenTypesTable).values({ name }).returning();
  res.status(201).json(st);
});

router.patch("/screen-types/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [st] = await db.update(screenTypesTable).set({ name }).where(eq(screenTypesTable.id, id)).returning();
  if (!st) {
    res.status(404).json({ error: "Screen type not found" });
    return;
  }
  res.json(st);
});

router.delete("/screen-types/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(screenTypesTable).where(eq(screenTypesTable.id, id));
  res.json({ message: "Screen type deleted" });
});

export default router;
