import { Router, type IRouter } from "express";
import { db, salesTable, saleItemsTable, productsTable, brandsTable, categoriesTable, screenTypesTable, phoneModelsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function getStatus(quantity: number, minStockLevel: number) {
  if (quantity === 0) return "out_of_stock";
  if (quantity <= minStockLevel) return "low_stock";
  return "in_stock";
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
  quantity: productsTable.quantity,
  minStockLevel: productsTable.minStockLevel,
  description: productsTable.description,
  createdAt: productsTable.createdAt,
};

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

async function getSalesReport(startDate: string, endDate: string) {
  const salesInRange = await db
    .select({
      saleDate: salesTable.saleDate,
      totalAmount: salesTable.totalAmount,
      itemCount: sql<number>`cast(count(${saleItemsTable.id}) as int)`,
    })
    .from(salesTable)
    .leftJoin(saleItemsTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(and(gte(salesTable.saleDate, startDate), lte(salesTable.saleDate, endDate)))
    .groupBy(salesTable.id, salesTable.saleDate, salesTable.totalAmount)
    .orderBy(desc(salesTable.saleDate));

  const items = salesInRange.map((s) => ({
    date: s.saleDate,
    totalAmount: parseFloat(String(s.totalAmount)),
    itemCount: s.itemCount,
  }));
  const totalAmount = items.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalItems = items.reduce((sum, i) => sum + i.itemCount, 0);
  return { totalAmount, totalItems, items };
}

router.get("/reports/daily", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const date = (req.query.date as string) || today;
  res.json(await getSalesReport(date, date));
});

router.get("/reports/weekly", requireAuth, async (req, res): Promise<void> => {
  const startDate = req.query.startDate as string;
  let start: Date;
  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date();
    start.setDate(start.getDate() - 6);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  res.json(await getSalesReport(fmt(start), fmt(end)));
});

router.get("/reports/monthly", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
  const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  res.json(await getSalesReport(startDate, endDate));
});

router.get("/reports/inventory", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .orderBy(productsTable.name);
  const products = rows.map(mapProduct);
  const totalValue = products.reduce((sum, p) => sum + p.sellingPrice * p.quantity, 0);
  res.json({ totalProducts: products.length, totalValue, products });
});

router.get("/reports/low-stock", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(and(sql`${productsTable.quantity} > 0`, sql`${productsTable.quantity} <= ${productsTable.minStockLevel}`))
    .orderBy(productsTable.quantity);
  const products = rows.map(mapProduct);
  res.json({ count: products.length, products });
});

router.get("/reports/out-of-stock", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select(productSelect)
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(screenTypesTable, eq(productsTable.screenTypeId, screenTypesTable.id))
    .leftJoin(phoneModelsTable, eq(productsTable.modelId, phoneModelsTable.id))
    .where(eq(productsTable.quantity, 0))
    .orderBy(productsTable.name);
  const products = rows.map(mapProduct);
  res.json({ count: products.length, products });
});

export default router;
