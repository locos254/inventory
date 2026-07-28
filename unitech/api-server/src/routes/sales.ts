import { Router, type IRouter } from "express";
import { db, salesTable, saleItemsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

type SaleType = "retail" | "wholesale" | "repair";

function computeUnitPrice(product: any, saleType: SaleType, overridePrice?: number): number {
  if (overridePrice != null && overridePrice > 0) return overridePrice;
  if (saleType === "wholesale") {
    return product.wholesale_price != null ? parseFloat(String(product.wholesale_price)) : parseFloat(String(product.selling_price));
  }
  return parseFloat(String(product.selling_price));
}

router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, page = "1", limit = "50" } = req.query as any;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(salesTable.saleDate, startDate));
  if (endDate) conditions.push(lte(salesTable.saleDate, endDate));

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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(salesTable.id)
    .orderBy(desc(salesTable.createdAt));

  const total = salesWithCount.length;
  const paginated = salesWithCount.slice(offset, offset + limitNum).map((s) => ({
    ...s,
    totalAmount: parseFloat(String(s.totalAmount)),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));

  res.json({ sales: paginated, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

// DIARY — must be before /:id
router.get("/sales/diary", requireAuth, async (req, res): Promise<void> => {
  const { date } = req.query as any;
  const targetDate = date || new Date().toISOString().split("T")[0];

  const sales = await db
    .select()
    .from(salesTable)
    .where(eq(salesTable.saleDate, targetDate))
    .orderBy(desc(salesTable.createdAt));

  const entries = [];
  let summaryRetailRevenue = 0, summaryWholesaleRevenue = 0, summaryRepairRevenue = 0, summaryRepairFeeIncome = 0;
  let summaryRetailProfit = 0, summaryWholesaleProfit = 0, summaryRepairProfit = 0;
  let summaryTotalRevenue = 0, summaryTotalCost = 0;

  for (const sale of sales) {
    const items = await db
      .select({
        id: saleItemsTable.id,
        productId: saleItemsTable.productId,
        productName: productsTable.name,
        quantity: saleItemsTable.quantity,
        unitPrice: saleItemsTable.unitPrice,
        total: saleItemsTable.total,
        saleType: saleItemsTable.saleType,
        repairFee: saleItemsTable.repairFee,
        costPrice: productsTable.costPrice,
      })
      .from(saleItemsTable)
      .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
      .where(eq(saleItemsTable.saleId, sale.id));

    const diaryItems = items.map((i) => {
      const qty = i.quantity;
      const unitPrice = parseFloat(String(i.unitPrice));
      const repairFee = parseFloat(String(i.repairFee ?? 0));
      const costPrice = parseFloat(String(i.costPrice ?? 0));
      const totalRevenue = unitPrice * qty + repairFee;
      const totalCost = costPrice * qty;
      const profit = totalRevenue - totalCost;
      const saleType = (i.saleType || "retail") as SaleType;

      summaryTotalRevenue += totalRevenue;
      summaryTotalCost += totalCost;
      if (saleType === "retail") { summaryRetailRevenue += totalRevenue; summaryRetailProfit += profit; }
      if (saleType === "wholesale") { summaryWholesaleRevenue += totalRevenue; summaryWholesaleProfit += profit; }
      if (saleType === "repair") { summaryRepairRevenue += unitPrice * qty; summaryRepairFeeIncome += repairFee; summaryRepairProfit += profit; }

      return {
        id: i.id,
        productId: i.productId,
        productName: i.productName ?? "Unknown",
        quantity: qty,
        saleType,
        unitPrice,
        repairFee,
        costPrice,
        totalRevenue,
        totalCost,
        profit,
      };
    });

    entries.push({
      saleId: sale.id,
      saleCreatedAt: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : sale.createdAt,
      notes: sale.notes,
      items: diaryItems,
    });
  }

  res.json({
    date: targetDate,
    entries,
    summary: {
      totalRevenue: summaryTotalRevenue,
      totalCost: summaryTotalCost,
      totalProfit: summaryTotalRevenue - summaryTotalCost,
      retailRevenue: summaryRetailRevenue,
      retailProfit: summaryRetailProfit,
      wholesaleRevenue: summaryWholesaleRevenue,
      wholesaleProfit: summaryWholesaleProfit,
      repairRevenue: summaryRepairRevenue,
      repairFeeIncome: summaryRepairFeeIncome,
      repairProfit: summaryRepairProfit,
    },
  });
});

router.post("/sales", requireAuth, async (req, res): Promise<void> => {
  const { items, saleDate, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one sale item is required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const date = saleDate || today;

  let totalAmount = 0;
  type ItemToInsert = {
    productId: number; quantity: number; unitPrice: number;
    total: number; productName: string; saleType: SaleType; repairFee: number;
  };
  const itemsToInsert: ItemToInsert[] = [];

  for (const item of items) {
    const productId = parseInt(item.productId, 10);
    const quantity = parseInt(item.quantity, 10);
    const saleType: SaleType = item.saleType || "retail";
    const repairFee = parseFloat(item.repairFee ?? 0) || 0;

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) {
      res.status(400).json({ error: `Product with id ${productId} not found` });
      return;
    }
    if (product.quantity < quantity) {
      res.status(400).json({ error: `Insufficient stock for "${product.name}". Available: ${product.quantity}` });
      return;
    }

    const unitPrice = computeUnitPrice(product, saleType, item.unitPrice);
    const lineTotal = unitPrice * quantity;
    totalAmount += lineTotal + repairFee;
    itemsToInsert.push({ productId, quantity, unitPrice, total: lineTotal, productName: product.name, saleType, repairFee });
  }

  const [sale] = await db.insert(salesTable).values({
    saleDate: date,
    totalAmount: String(totalAmount),
    notes: notes || null,
  }).returning();

  for (const item of itemsToInsert) {
    await db.insert(saleItemsTable).values({
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      total: String(item.total),
      saleType: item.saleType,
      repairFee: String(item.repairFee),
    });
    await db
      .update(productsTable)
      .set({ quantity: sql`${productsTable.quantity} - ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }

  res.status(201).json({
    id: sale.id,
    saleDate: sale.saleDate,
    totalAmount: parseFloat(String(sale.totalAmount)),
    notes: sale.notes,
    itemCount: itemsToInsert.length,
    createdAt: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : sale.createdAt,
  });
});

router.get("/sales/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }
  const items = await db
    .select({
      id: saleItemsTable.id,
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      quantity: saleItemsTable.quantity,
      unitPrice: saleItemsTable.unitPrice,
      total: saleItemsTable.total,
      saleType: saleItemsTable.saleType,
      repairFee: saleItemsTable.repairFee,
      costPrice: productsTable.costPrice,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, id));

  res.json({
    id: sale.id,
    saleDate: sale.saleDate,
    totalAmount: parseFloat(String(sale.totalAmount)),
    notes: sale.notes,
    createdAt: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : sale.createdAt,
    items: items.map((i) => {
      const qty = i.quantity;
      const unitPrice = parseFloat(String(i.unitPrice));
      const repairFee = parseFloat(String(i.repairFee ?? 0));
      const costPrice = parseFloat(String(i.costPrice ?? 0));
      return {
        id: i.id,
        productId: i.productId,
        productName: i.productName ?? "Unknown",
        quantity: qty,
        unitPrice,
        repairFee,
        saleType: i.saleType || "retail",
        costPrice,
        total: parseFloat(String(i.total)),
        profit: (unitPrice - costPrice) * qty + repairFee,
      };
    }),
  });
});

router.delete("/sales/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  for (const item of items) {
    await db
      .update(productsTable)
      .set({ quantity: sql`${productsTable.quantity} + ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }
  await db.delete(salesTable).where(eq(salesTable.id, id));
  res.json({ message: "Sale deleted and stock restored" });
});

export default router;
