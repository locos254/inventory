import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable, salesTable, saleItemsTable, brandsTable, screenTypesTable, phoneModelsTable } from "@workspace/db";
import { eq, sql, desc, gte, lte, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

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
  quantity: productsTable.quantity,
  minStockLevel: productsTable.minStockLevel,
  description: productsTable.description,
  createdAt: productsTable.createdAt,
};

function getStatus(quantity: number, minStockLevel: number) {
  if (quantity === 0) return "out_of_stock";
  if (quantity <= minStockLevel) return "low_stock";
  return "in_stock";
}

function mapProduct(row: any) {
  return {
    ...row,
    brandName: row.brandName ?? null,
    categoryName: row.categoryName ?? null,
    screenTypeName: row.screenTypeName ?? null,
    modelName: row.modelName ?? null,
    modelNumber: row.modelNumber ?? null,
    costPrice: parseFloat(row.costPrice),
    sellingPrice: parseFloat(row.sellingPrice),
    description: row.description ?? null,
    status: getStatus(row.quantity, row.minStockLevel),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`cast(count(*) as int)` }).from(productsTable);
  const [{ totalCategories }] = await db.select({ totalCategories: sql<number>`cast(count(*) as int)` }).from(categoriesTable);
  const [{ totalStock }] = await db.select({ totalStock: sql<number>`cast(coalesce(sum(${productsTable.quantity}), 0) as int)` }).from(productsTable);
  const [{ lowStockCount }] = await db.select({ lowStockCount: sql<number>`cast(count(*) as int)` }).from(productsTable).where(and(sql`${productsTable.quantity} > 0`, sql`${productsTable.quantity} <= ${productsTable.minStockLevel}`));
  const [{ outOfStockCount }] = await db.select({ outOfStockCount: sql<number>`cast(count(*) as int)` }).from(productsTable).where(eq(productsTable.quantity, 0));

  const todaySalesRows = await db.select({ total: sql<number>`coalesce(sum(cast(${salesTable.totalAmount} as numeric)), 0)` }).from(salesTable).where(eq(salesTable.saleDate, today));
  const monthSalesRows = await db.select({ total: sql<number>`coalesce(sum(cast(${salesTable.totalAmount} as numeric)), 0)` }).from(salesTable).where(and(gte(salesTable.saleDate, firstOfMonth), lte(salesTable.saleDate, today)));

  res.json({
    totalProducts,
    totalCategories,
    totalStock,
    todaySales: parseFloat(String(todaySalesRows[0]?.total ?? 0)),
    monthSales: parseFloat(String(monthSalesRows[0]?.total ?? 0)),
    lowStockCount,
    outOfStockCount,
  });
});

router.get("/dashboard/recent-products", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .orderBy(desc(productsTable.createdAt))
    .limit(10);
  res.json(rows.map(mapProduct));
});

router.get("/dashboard/recent-sales", requireAuth, async (_req, res): Promise<void> => {
  const salesWithCount = await db
    .select({
      id: salesTable.id,
      saleDate: salesTable.saleDate,
      totalAmount: salesTable.totalAmount,
      notes: salesTable.notes,
      createdAt: salesTable.createdAt,
      itemCount: sql<number>`cast(count(${saleItemsTable.id}) as int)`,
    })
    .from(salesTable)
    .leftJoin(saleItemsTable, eq(saleItemsTable.saleId, salesTable.id))
    .groupBy(salesTable.id)
    .orderBy(desc(salesTable.createdAt))
    .limit(10);
  res.json(salesWithCount.map((s) => ({
    ...s,
    totalAmount: parseFloat(String(s.totalAmount)),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  })));
});

export default router;
