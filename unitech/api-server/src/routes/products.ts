import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable, brandsTable, phoneModelsTable, screenTypesTable } from "@workspace/db";
import { eq, ilike, and, sql, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateBarcode } from "../lib/barcode";

const router: IRouter = Router();

function getStatus(quantity: number, minStockLevel: number): string {
  if (quantity === 0) return "out_of_stock";
  if (quantity <= minStockLevel) return "low_stock";
  return "in_stock";
}

function mapProduct(row: any) {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    brandId: row.brandId ?? null,
    brandName: row.brandName ?? null,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    screenTypeId: row.screenTypeId ?? null,
    screenTypeName: row.screenTypeName ?? null,
    modelId: row.modelId ?? null,
    modelName: row.modelName ?? null,
    modelNumber: row.modelNumber ?? null,
    costPrice: parseFloat(row.costPrice),
    sellingPrice: parseFloat(row.sellingPrice),
    wholesalePrice: row.wholesalePrice != null ? parseFloat(row.wholesalePrice) : null,
    quantity: row.quantity,
    minStockLevel: row.minStockLevel,
    description: row.description ?? null,
    status: getStatus(row.quantity, row.minStockLevel),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

const productSelect = {
  id: productsTable.id,
  name: productsTable.name,
  barcode: productsTable.barcode,
  brandId: productsTable.brandId,
  brandName: brandsTable.name,
  categoryId: productsTable.categoryId,
  categoryName: categoriesTable.name,
  screenTypeId: productsTable.screenTypeId,
  screenTypeName: screenTypesTable.name,
  modelId: productsTable.modelId,
  modelName: phoneModelsTable.name,
  modelNumber: productsTable.modelNumber,
  costPrice: productsTable.costPrice,
  sellingPrice: productsTable.sellingPrice,
  wholesalePrice: productsTable.wholesalePrice,
  quantity: productsTable.quantity,
  minStockLevel: productsTable.minStockLevel,
  description: productsTable.description,
  createdAt: productsTable.createdAt,
};

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const { search, categoryId, brandId, status, page = "1", limit = "50", sortBy = "createdAt", sortOrder = "desc" } = req.query as any;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (search) conditions.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.barcode, `%${search}%`)));
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId, 10)));
  if (brandId) conditions.push(eq(productsTable.brandId, parseInt(brandId, 10)));

  const baseQuery = db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id));

  const allRows = await (conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery);
  let mapped = allRows.map(mapProduct);

  if (status) mapped = mapped.filter((p) => p.status === status);

  const sortMap: Record<string, (a: any, b: any) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    costPrice: (a, b) => a.costPrice - b.costPrice,
    sellingPrice: (a, b) => a.sellingPrice - b.sellingPrice,
    wholesalePrice: (a, b) => (a.wholesalePrice ?? 0) - (b.wholesalePrice ?? 0),
    quantity: (a, b) => a.quantity - b.quantity,
    createdAt: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    barcode: (a, b) => a.barcode.localeCompare(b.barcode),
    brandName: (a, b) => (a.brandName ?? "").localeCompare(b.brandName ?? ""),
    categoryName: (a, b) => (a.categoryName ?? "").localeCompare(b.categoryName ?? ""),
  };
  if (sortMap[sortBy]) {
    mapped.sort(sortMap[sortBy]);
    if (sortOrder === "desc") mapped.reverse();
  }

  const total = mapped.length;
  const products = mapped.slice(offset, offset + limitNum);
  res.json({ products, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

router.get("/products/low-stock", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(and(sql`${productsTable.quantity} > 0`, sql`${productsTable.quantity} <= ${productsTable.minStockLevel}`));
  res.json(rows.map(mapProduct));
});

router.get("/products/out-of-stock", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(eq(productsTable.quantity, 0));
  res.json(rows.map(mapProduct));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(eq(productsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(mapProduct(rows[0]));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { name, brandId, categoryId, screenTypeId, modelId, modelNumber, costPrice, sellingPrice, wholesalePrice, quantity, minStockLevel, description } = req.body;
  if (!name || costPrice == null || sellingPrice == null || quantity == null || minStockLevel == null) {
    res.status(400).json({ error: "Name, costPrice, sellingPrice, quantity, minStockLevel are required" });
    return;
  }
  const barcode = generateBarcode();
  const [product] = await db.insert(productsTable).values({
    name,
    barcode,
    brandId: brandId ? parseInt(brandId, 10) : null,
    categoryId: categoryId ? parseInt(categoryId, 10) : null,
    screenTypeId: screenTypeId ? parseInt(screenTypeId, 10) : null,
    modelId: modelId ? parseInt(modelId, 10) : null,
    modelNumber: modelNumber || null,
    costPrice: String(costPrice),
    sellingPrice: String(sellingPrice),
    wholesalePrice: wholesalePrice != null ? String(wholesalePrice) : null,
    quantity: parseInt(quantity, 10),
    minStockLevel: parseInt(minStockLevel, 10),
    description: description || null,
  }).returning();

  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(eq(productsTable.id, product.id));
  res.status(201).json(mapProduct(rows[0]));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, brandId, categoryId, screenTypeId, modelId, modelNumber, costPrice, sellingPrice, wholesalePrice, quantity, minStockLevel, description } = req.body;
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (brandId !== undefined) updateData.brandId = brandId ? parseInt(brandId, 10) : null;
  if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId, 10) : null;
  if (screenTypeId !== undefined) updateData.screenTypeId = screenTypeId ? parseInt(screenTypeId, 10) : null;
  if (modelId !== undefined) updateData.modelId = modelId ? parseInt(modelId, 10) : null;
  if (modelNumber !== undefined) updateData.modelNumber = modelNumber || null;
  if (costPrice !== undefined) updateData.costPrice = String(costPrice);
  if (sellingPrice !== undefined) updateData.sellingPrice = String(sellingPrice);
  if (wholesalePrice !== undefined) updateData.wholesalePrice = wholesalePrice != null && wholesalePrice !== "" ? String(wholesalePrice) : null;
  if (quantity !== undefined) updateData.quantity = parseInt(quantity, 10);
  if (minStockLevel !== undefined) updateData.minStockLevel = parseInt(minStockLevel, 10);
  if (description !== undefined) updateData.description = description || null;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  await db.update(productsTable).set(updateData).where(eq(productsTable.id, id));
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(eq(productsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(mapProduct(rows[0]));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ message: "Product deleted" });
});

export default router;
