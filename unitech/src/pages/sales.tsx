import { useState, useMemo } from "react";
import {
  useGetProducts,
  useCreateSale,
  useGetSales,
  useDeleteSale,
  useGetSalesDiary,
  Product,
  SaleType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, BookOpen, TrendingUp, Wrench, Package, PlusCircle, ChevronDown, ShoppingCart, Tag, Hash, Banknote, Receipt, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

const fmt = (n: number) =>
  "KSh " + new Intl.NumberFormat("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

// Book-style grouping: which "chapter" (This Week / Last Week / Earlier) a
// given sale date belongs to, so the diary reads like a ledger you flip
// through — nothing is ever removed, it just gets filed under its week.
function getMonday(d: Date): Date {
  const nd = new Date(d);
  const day = nd.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day;
  nd.setDate(nd.getDate() + diff);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function weekLabelFor(dateStr: string): "This Week" | "Last Week" | "Earlier" {
  const d = new Date(dateStr + "T00:00:00");
  const thisMonday = getMonday(new Date());
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  if (d >= thisMonday) return "This Week";
  if (d >= lastMonday) return "Last Week";
  return "Earlier";
}

const TYPE_LABEL: Record<SaleType, string> = {
  retail: "Retail",
  wholesale: "Wholesale / Fundi",
  repair: "Screen Repair",
};

const TYPE_COLOR: Record<SaleType, string> = {
  retail: "bg-blue-50 text-blue-700 border-blue-200",
  wholesale: "bg-purple-50 text-purple-700 border-purple-200",
  repair: "bg-amber-50 text-amber-700 border-amber-200",
};

const TYPE_ACCENT: Record<SaleType, string> = {
  retail: "border-l-blue-400",
  wholesale: "border-l-purple-400",
  repair: "border-l-amber-400",
};

const TYPE_ICON_BG: Record<SaleType, string> = {
  retail: "bg-blue-100 text-blue-600",
  wholesale: "bg-purple-100 text-purple-600",
  repair: "bg-amber-100 text-amber-600",
};

// One field per line covers everything now:
// - retail / wholesale: unitPrice is the selling price for the product
// - repair: unitPrice is simply the total repair fee charged (no second field)
interface LineItem {
  key: number;
  product: Product;
  qty: number;
  unitPrice: number;
  saleType: SaleType;
}

function getAutoPrice(p: Product, t: SaleType): number {
  if (t === "wholesale") return p.wholesalePrice ?? p.sellingPrice;
  if (t === "repair") return 0; // no suggested price for a repair job — shopkeeper enters the fee
  return p.sellingPrice;
}

// The floor price for any product — a shop owner can discount down to this,
// but never below it, so a sale never runs at a loss. Doesn't apply to
// repair fees, since those are a labour charge, not a stocked product price.
function getMinPrice(p: Product): number {
  return (p as any).costPrice ?? 0;
}

function clampToNoLoss(p: Product, price: number): { price: number; clamped: boolean } {
  const min = getMinPrice(p);
  if (min > 0 && price < min) {
    return { price: min, clamped: true };
  }
  return { price, clamped: false };
}

// How much was knocked off the normal price — computed automatically,
// never typed in separately. Retail/Wholesale only; repair has no baseline.
function getDiscount(p: Product, t: SaleType, price: number): number {
  if (t === "repair") return 0;
  const normal = getAutoPrice(p, t);
  const diff = normal - price;
  return diff > 0 ? diff : 0;
}

export default function Sales() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"new" | "diary">("new");
  const [diaryDate, setDiaryDate] = useState(() => new Date().toISOString().split("T")[0]);
  // Which day's page of the diary book is currently open. Nothing else is
  // ever discarded — every day's sales stay fetched and grouped, this just
  // tracks which page is unfolded.
  const [expandedDate, setExpandedDate] = useState<string | null>(() => new Date().toISOString().split("T")[0]);

  // draft state
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [lineKey, setLineKey] = useState(0);

  // row-being-filled
  const [pickedId, setPickedId] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [pickType, setPickType] = useState<SaleType>("retail");
  const [pickPrice, setPickPrice] = useState("");

  const { data: allProducts } = useGetProducts({ limit: 500 });
  const createSale = useCreateSale();
  const deleteSale = useDeleteSale();
  const { data: salesPage, isLoading: loadingSales } = useGetSales({ limit: 300 });
  const { data: diary, isLoading: loadingDiary, refetch: refetchDiary } = useGetSalesDiary(
    { date: diaryDate },
    { query: { queryKey: ["diary", diaryDate] } }
  );

  // Every sale, grouped by the day it happened — this is the "book": no
  // sale is ever dropped from it, days just get filed under a week chapter.
  const salesByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof salesPage>["sales"]>();
    (salesPage?.sales ?? []).forEach(s => {
      const list = map.get(s.saleDate) ?? [];
      list.push(s);
      map.set(s.saleDate, list);
    });
    return map;
  }, [salesPage]);

  const bookGroups = useMemo(() => {
    const sortedDates = Array.from(salesByDate.keys()).sort((a, b) => b.localeCompare(a));
    const order: Array<"This Week" | "Last Week" | "Earlier"> = ["This Week", "Last Week", "Earlier"];
    const buckets: Record<string, string[]> = { "This Week": [], "Last Week": [], "Earlier": [] };
    sortedDates.forEach(d => buckets[weekLabelFor(d)].push(d));
    return order.map(label => ({ label, dates: buckets[label] })).filter(g => g.dates.length > 0);
  }, [salesByDate]);

  const products = allProducts?.products ?? [];
  const selectedProduct = products.find(p => String(p.id) === pickedId) ?? null;
  const pickPriceNum = parseFloat(pickPrice) || 0;
  const currentDiscount = selectedProduct ? getDiscount(selectedProduct, pickType, pickPriceNum) : 0;

  const handleProductChange = (id: string) => {
    setPickedId(id);
    const p = products.find(pr => String(pr.id) === id);
    if (p) setPickPrice(pickType === "repair" ? "" : String(getAutoPrice(p, pickType)));
  };

  const handleTypeChange = (t: SaleType) => {
    setPickType(t);
    if (t === "repair") {
      setPickPrice("");
    } else if (selectedProduct) {
      setPickPrice(String(getAutoPrice(selectedProduct, t)));
    }
  };

  // Live-clamp the price a shopkeeper types for a client discount, so it can
  // never dip below the product's cost price. Doesn't apply to repair fees.
  const handlePickPriceBlur = () => {
    if (!selectedProduct || pickType === "repair") return;
    const raw = parseFloat(pickPrice) || 0;
    const { price, clamped } = clampToNoLoss(selectedProduct, raw);
    if (clamped) {
      toast.error(`Lowest price for ${selectedProduct.name} is ${fmt(price)} (cost price) — can't sell at a loss`);
      setPickPrice(String(price));
    }
  };

  const handleAddLine = () => {
    if (!selectedProduct) { toast.error("Pick a product first"); return; }
    const qty = Math.max(1, pickQty);
    let price = parseFloat(pickPrice) || 0;
    if (price <= 0) {
      toast.error(pickType === "repair" ? "Enter the repair fee" : "Enter a valid price");
      return;
    }
    if (qty > selectedProduct.quantity) {
      toast.error(`Only ${selectedProduct.quantity} in stock`); return;
    }
    if (pickType !== "repair") {
      const { price: safePrice, clamped } = clampToNoLoss(selectedProduct, price);
      if (clamped) {
        toast.error(`Price adjusted to ${fmt(safePrice)} — that's cost price, the lowest you can sell at`);
      }
      price = safePrice;
    }
    setLines(prev => [...prev, {
      key: lineKey, product: selectedProduct, qty, unitPrice: price, saleType: pickType,
    }]);
    setLineKey(k => k + 1);
    setPickedId(""); setPickQty(1); setPickPrice(""); setPickType("retail");
  };

  const removeLine = (key: number) => setLines(prev => prev.filter(l => l.key !== key));

  const updateLine = (key: number, field: "qty" | "unitPrice" | "saleType", val: string | number | SaleType) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      if (field === "saleType") {
        const t = val as SaleType;
        const newPrice = t === "repair" ? l.unitPrice : getAutoPrice(l.product, t);
        return { ...l, saleType: t, unitPrice: newPrice };
      }
      if (field === "unitPrice") {
        const raw = typeof val === "string" ? parseFloat(val) || 0 : (val as number);
        if (l.saleType === "repair") return { ...l, unitPrice: raw };
        const { price: safePrice, clamped } = clampToNoLoss(l.product, raw);
        if (clamped) {
          toast.error(`Lowest price for ${l.product.name} is ${fmt(safePrice)} — can't sell at a loss`);
        }
        return { ...l, unitPrice: safePrice };
      }
      return { ...l, [field]: typeof val === "string" ? parseInt(val) || 1 : val };
    }));
  };

  const grandTotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const handleSubmit = () => {
    if (lines.length === 0) { toast.error("Add at least one item"); return; }
    createSale.mutate({
      data: {
        notes: notes || undefined,
        items: lines.map(l => ({
          productId: l.product.id, quantity: l.qty, saleType: l.saleType,
          unitPrice: l.unitPrice, repairFee: 0,
        })),
      },
    }, {
      onSuccess: () => {
        toast.success("Sale saved!");
        setLines([]); setNotes("");
        qc.invalidateQueries({ queryKey: ["/api/sales"] });
        qc.invalidateQueries({ queryKey: ["/api/products"] });
        qc.invalidateQueries({ queryKey: ["diary"] });
        refetchDiary();
        setTab("diary");
      },
      onError: (e: any) => toast.error(e?.data?.error || "Failed to save"),
    });
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: "Delete sale?", text: "Stock will be restored.", icon: "warning",
      showCancelButton: true, confirmButtonColor: "#dc2626", confirmButtonText: "Delete",
    }).then(r => {
      if (r.isConfirmed) {
        deleteSale.mutate({ id }, {
          onSuccess: () => {
            toast.success("Deleted");
            qc.invalidateQueries({ queryKey: ["/api/sales"] });
            qc.invalidateQueries({ queryKey: ["/api/products"] });
            qc.invalidateQueries({ queryKey: ["diary"] });
            refetchDiary();
          },
        });
      }
    });
  };

  return (
    <Layout title="Sales">
      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-border overflow-x-auto">
        {(["new", "diary"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 sm:px-5 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "new" ? "📝  New Sale" : "📖  Sales Diary"}
          </button>
        ))}
      </div>

      {/* ─── NEW SALE ──────────────────────────────────────────── */}
      {tab === "new" && (
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">

          {/* Book-style entry area */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-md shadow-slate-200/60">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-white/15 rounded-lg p-1.5 shrink-0">
                  <ShoppingCart className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-sm text-white block leading-tight">Record Items Sold</span>
                  <span className="text-[11px] text-blue-100 hidden sm:block">{new Date().toLocaleDateString("en-KE", { dateStyle: "full" })}</span>
                </div>
              </div>
              {lines.length > 0 && (
                <span className="text-xs font-semibold bg-white/20 text-white px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                  {lines.length} item{lines.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Empty state before anything is added */}
            {lines.length === 0 && (
              <div className="py-10 px-4 text-center">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 mb-2.5">
                  <PlusCircle className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-foreground">No items added yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Use the form below to add the first item</p>
              </div>
            )}

            {/* Existing lines */}
            {lines.length > 0 && (
              <div className="divide-y">
                {/* Column headers — desktop only */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-2 items-center px-4 py-2 bg-slate-50/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Product</span>
                  <span>Type</span>
                  <span className="text-right">{"Price / Fee (KSh)"}</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {lines.map((line, i) => {
                  const lineDiscount = getDiscount(line.product, line.saleType, line.unitPrice);
                  return (
                  <div key={line.key} className={`px-4 py-2.5 text-sm border-l-4 ${TYPE_ACCENT[line.saleType]} ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-2 items-center">
                      <div className="min-w-0 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${TYPE_ICON_BG[line.saleType]}`}>
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{line.product.name}</span>
                          {lineDiscount > 0 && (
                            <span className="text-xs text-orange-600 whitespace-nowrap">− {fmt(lineDiscount)} discount</span>
                          )}
                        </div>
                      </div>

                      <select
                        value={line.saleType}
                        onChange={e => updateLine(line.key, "saleType", e.target.value as SaleType)}
                        className={`text-xs px-2 py-1 rounded border font-medium ${TYPE_COLOR[line.saleType]}`}
                      >
                        <option value="retail">Retail</option>
                        {line.product.wholesalePrice && <option value="wholesale">Wholesale</option>}
                        <option value="repair">Repair</option>
                      </select>

                      <div className="text-right">
                        <Input
                          type="number" min={line.saleType === "repair" ? 0 : (getMinPrice(line.product) || 0)} step="1"
                          value={line.unitPrice}
                          onChange={e => updateLine(line.key, "unitPrice", e.target.value)}
                          className="h-7 w-24 text-right text-sm ml-auto"
                          title={line.saleType !== "repair" && getMinPrice(line.product) > 0 ? `Won't go below cost price ${fmt(getMinPrice(line.product))}` : undefined}
                        />
                      </div>

                      <div className="text-right">
                        <Input
                          type="number" min="1"
                          value={line.qty}
                          onChange={e => updateLine(line.key, "qty", e.target.value)}
                          className="h-7 w-16 text-right text-sm ml-auto"
                        />
                      </div>

                      <span className="text-right font-semibold text-sm whitespace-nowrap">
                        {fmt(line.unitPrice * line.qty)}
                      </span>

                      <button onClick={() => removeLine(line.key)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${TYPE_ICON_BG[line.saleType]}`}>
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{line.product.name}</span>
                            {lineDiscount > 0 && (
                              <span className="block text-xs text-orange-600">− {fmt(lineDiscount)} discount</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => removeLine(line.key)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <select
                        value={line.saleType}
                        onChange={e => updateLine(line.key, "saleType", e.target.value as SaleType)}
                        className={`w-full text-xs px-2 py-1.5 rounded border font-medium ${TYPE_COLOR[line.saleType]}`}
                      >
                        <option value="retail">Retail</option>
                        {line.product.wholesalePrice && <option value="wholesale">Wholesale</option>}
                        <option value="repair">Repair</option>
                      </select>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {line.saleType === "repair" ? "Repair Fee (KSh)" : "Price (KSh)"}
                          </label>
                          <Input
                            type="number" min={line.saleType === "repair" ? 0 : (getMinPrice(line.product) || 0)} step="1"
                            value={line.unitPrice}
                            onChange={e => updateLine(line.key, "unitPrice", e.target.value)}
                            className="h-8 w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Qty</label>
                          <Input
                            type="number" min="1"
                            value={line.qty}
                            onChange={e => updateLine(line.key, "qty", e.target.value)}
                            className="h-8 w-full text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t">
                        <span className="text-xs text-muted-foreground">Line total</span>
                        <span className="font-semibold">{fmt(line.unitPrice * line.qty)}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Add new line row */}
            <div className="border-t bg-gradient-to-b from-blue-50/50 to-slate-50/50 px-4 py-4">
              <p className="text-xs font-bold text-blue-900/70 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" /> Add item
              </p>
              <div className="flex flex-wrap gap-2.5 items-end">
                {/* Product dropdown */}
                <div className="w-full sm:flex-1 sm:min-w-[180px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Product
                  </label>
                  <select
                    value={pickedId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  >
                    <option value="">— select product —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                        {p.name}{p.quantity === 0 ? " (out of stock)" : ` — KSh ${p.sellingPrice}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div className="w-[calc(50%-5px)] sm:w-auto">
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Type
                  </label>
                  <select
                    value={pickType}
                    onChange={e => handleTypeChange(e.target.value as SaleType)}
                    className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  >
                    <option value="retail">Retail</option>
                    {selectedProduct?.wholesalePrice && <option value="wholesale">Wholesale / Fundi</option>}
                    <option value="repair">Screen Repair</option>
                  </select>
                </div>

                {/* Price / Repair Fee — one field covers both */}
                <div className="w-[calc(50%-5px)] sm:w-auto">
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Banknote className="h-3 w-3" /> {pickType === "repair" ? "Repair Fee (KSh)" : "Price (KSh)"}
                  </label>
                  <Input
                    type="number"
                    min={pickType === "repair" ? 0 : (selectedProduct ? (getMinPrice(selectedProduct) || 0) : 0)}
                    step="1"
                    placeholder={pickType === "repair" ? "Total charged" : "Price"}
                    value={pickPrice}
                    onChange={e => setPickPrice(e.target.value)}
                    onBlur={handlePickPriceBlur}
                    className="w-full sm:w-28 h-9 shadow-sm focus-visible:ring-blue-500/40"
                  />
                </div>

                {/* Qty */}
                <div className="w-[calc(50%-5px)] sm:w-auto">
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Qty
                  </label>
                  <Input
                    type="number" min="1"
                    value={pickQty}
                    onChange={e => setPickQty(parseInt(e.target.value) || 1)}
                    className="w-full sm:w-16 h-9 shadow-sm focus-visible:ring-blue-500/40"
                  />
                </div>

                <Button onClick={handleAddLine} variant="default" size="sm" className="h-9 gap-1.5 shrink-0 w-full sm:w-auto shadow-sm bg-blue-600 hover:bg-blue-700">
                  <PlusCircle className="h-4 w-4" /> Add Line
                </Button>
              </div>

              {/* Stock + no-loss + discount hint — all computed automatically */}
              {selectedProduct && (
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p>
                    {selectedProduct.name} — stock: <strong className="text-foreground">{selectedProduct.quantity}</strong>
                    {selectedProduct.wholesalePrice && ` · wholesale: KSh ${selectedProduct.wholesalePrice}`}
                    {pickType !== "repair" && getMinPrice(selectedProduct) > 0 && (
                      <> · lowest no-loss price: <strong className="text-amber-700">{fmt(getMinPrice(selectedProduct))}</strong></>
                    )}
                    {pickType === "repair" && (
                      <> · enter the full amount charged for this repair</>
                    )}
                    {currentDiscount > 0 && (
                      <> · <strong className="text-orange-700">discount: {fmt(currentDiscount)} off normal price</strong></>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes + total + submit — styled like a receipt about to be torn off */}
          {lines.length > 0 && (
            <div className="relative">
              <div className="bg-white border border-border rounded-t-2xl px-4 sm:px-5 pt-4 pb-5 shadow-md shadow-slate-200/60">
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end justify-between">
                  <div className="flex-1 sm:max-w-xs">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Notes (optional)</label>
                    <Input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Customer name, reference..."
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-end justify-between sm:justify-end gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-dashed border-border pt-3 sm:pt-0 sm:pl-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Receipt className="h-3.5 w-3.5" /> Total
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-blue-700">{fmt(grandTotal)}</p>
                    </div>
                    <Button
                      size="lg" onClick={handleSubmit}
                      disabled={createSale.isPending}
                      className="h-11 px-6 gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm shrink-0"
                    >
                      {createSale.isPending ? "Saving..." : "Save Sale"}
                    </Button>
                  </div>
                </div>
              </div>
              {/* Torn-receipt edge */}
              <div
                className="h-3 rounded-b-2xl"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 8px 0, transparent 8px, white 8.5px)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 -8px",
                  backgroundRepeat: "repeat-x",
                }}
              />
            </div>
          )}
        </div>

        {/* Recent sales — sidebar on desktop, stacks below on mobile */}
        <div className="lg:sticky lg:top-4">
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b px-4 sm:px-5 py-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Recent Sales</span>
            </div>
            {loadingSales ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : !salesPage?.sales.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No sales yet.</div>
            ) : (
              <div className="divide-y max-h-[520px] overflow-y-auto">
                {salesPage.sales.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                        <Banknote className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold">{fmt(s.totalAmount)}</span>
                        <span className="text-muted-foreground ml-2 sm:ml-3 text-xs block sm:inline">{s.saleDate} · {s.itemCount} item{s.itemCount !== 1 ? "s" : ""}</span>
                        {s.notes && <span className="text-muted-foreground ml-0 sm:ml-2 text-xs italic block sm:inline truncate">"{s.notes}"</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ─── DIARY ─────────────────────────────────────────────── */}
      {tab === "diary" && (
        <div className="w-full max-w-7xl mx-auto space-y-4">
          {/* Header + jump-to-any-date */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Sales Diary
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Every sale ever recorded — kept, grouped by week and day, like a ledger.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-muted-foreground shrink-0">Jump to date</label>
              <Input
                type="date" value={diaryDate}
                onChange={e => { setDiaryDate(e.target.value); setExpandedDate(e.target.value); }}
                className="w-full sm:w-auto bg-white"
              />
            </div>
          </div>

          {loadingSales ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : bookGroups.length === 0 ? (
            <div className="bg-white border rounded-xl py-14 text-center text-muted-foreground text-sm">
              <BookOpen className="h-7 w-7 mx-auto mb-2 opacity-30" />
              No sales recorded yet — every sale you save in "New Sale" will show up here, filed under its day.
            </div>
          ) : (
            <div className="space-y-5">
              {bookGroups.map(group => (
                <div key={group.label}>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">{group.label}</h3>
                  <div className="bg-white border border-border rounded-xl divide-y overflow-hidden shadow-sm">
                    {group.dates.map(dateStr => {
                      const daySales = salesByDate.get(dateStr) ?? [];
                      const dayTotal = daySales.reduce((s, x) => s + x.totalAmount, 0);
                      const isOpen = expandedDate === dateStr;
                      return (
                        <div key={dateStr}>
                          <button
                            onClick={() => {
                              if (isOpen) { setExpandedDate(null); }
                              else { setExpandedDate(dateStr); setDiaryDate(dateStr); }
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${isOpen ? "bg-slate-50" : ""}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{fmtDate(dateStr)}</p>
                              <p className="text-xs text-muted-foreground">{daySales.length} sale{daySales.length !== 1 ? "s" : ""} · {fmt(dayTotal)}</p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>

                          {isOpen && (
                            <div className="border-t bg-slate-50/40 px-3 sm:px-4 py-4 space-y-4">
                              {loadingDiary ? (
                                <div className="py-6 text-center text-muted-foreground text-sm">Loading day...</div>
                              ) : !diary || diary.date !== dateStr ? (
                                <div className="py-6 text-center text-muted-foreground text-sm">Loading day...</div>
                              ) : (
                                <>
                                  {/* Summary cards for this day */}
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                                    <DiaryCard icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="Total Profit" value={fmt(diary.summary.totalProfit)} sub={`Revenue ${fmt(diary.summary.totalRevenue)}`} color="green" />
                                    <DiaryCard icon={<Package className="h-4 w-4 text-blue-600" />} label="Retail Profit" value={fmt(diary.summary.retailProfit)} sub={`Revenue ${fmt(diary.summary.retailRevenue)}`} color="blue" />
                                    <DiaryCard icon={<Package className="h-4 w-4 text-purple-600" />} label="Wholesale Profit" value={fmt(diary.summary.wholesaleProfit)} sub={`Revenue ${fmt(diary.summary.wholesaleRevenue)}`} color="purple" />
                                    <DiaryCard icon={<Wrench className="h-4 w-4 text-amber-600" />} label="Repair Profit" value={fmt(diary.summary.repairProfit)} sub={`Fees ${fmt(diary.summary.repairFeeIncome)}`} color="amber" />
                                  </div>

                                  {diary.entries.length === 0 ? (
                                    <div className="py-6 text-center text-muted-foreground text-sm">No entries for this date.</div>
                                  ) : (
                                    <div className="space-y-3">
                                      {diary.entries.map((entry, i) => {
                                        const entryRevenue = entry.items.reduce((s, it) => s + it.totalRevenue, 0);
                                        const entryProfit = entry.items.reduce((s, it) => s + it.profit, 0);
                                        return (
                                          <div key={entry.saleId} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                                            {/* Entry header */}
                                            <div className="flex flex-wrap justify-between items-center gap-1 px-4 py-2.5 bg-slate-50 border-b text-sm">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>
                                                <span className="font-medium truncate">Sale at {fmtTime(entry.saleCreatedAt)}</span>
                                                {entry.notes && <span className="text-xs text-muted-foreground italic truncate">— {entry.notes}</span>}
                                              </div>
                                              <span className="text-xs text-muted-foreground shrink-0">{entry.items.length} item{entry.items.length !== 1 ? "s" : ""}</span>
                                            </div>

                                            {/* Desktop table */}
                                            <div className="hidden md:block overflow-x-auto">
                                              <table className="w-full text-sm">
                                                <thead>
                                                  <tr className="text-xs text-muted-foreground border-b bg-slate-50/40">
                                                    <th className="text-left px-4 py-2 font-medium">Product</th>
                                                    <th className="px-3 py-2 font-medium">Type</th>
                                                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                                                    <th className="px-3 py-2 font-medium text-right">Price</th>
                                                    <th className="px-3 py-2 font-medium text-right">Cost</th>
                                                    <th className="px-3 py-2 font-medium text-right">Repair Fee</th>
                                                    <th className="px-3 py-2 font-medium text-right">Revenue</th>
                                                    <th className="px-3 py-2 font-medium text-right">Profit</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                  {entry.items.map(item => (
                                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                                      <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                                                      <td className="px-3 py-2.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLOR[item.saleType]}`}>
                                                          {TYPE_LABEL[item.saleType]}
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-2.5 text-right text-muted-foreground">{item.quantity}</td>
                                                      <td className="px-3 py-2.5 text-right">{fmt(item.unitPrice)}</td>
                                                      <td className="px-3 py-2.5 text-right text-muted-foreground">{fmt(item.costPrice)}</td>
                                                      <td className="px-3 py-2.5 text-right">
                                                        {item.repairFee > 0
                                                          ? <span className="font-medium text-amber-700">{fmt(item.repairFee)}</span>
                                                          : <span className="text-muted-foreground/30">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2.5 text-right font-medium">{fmt(item.totalRevenue)}</td>
                                                      <td className="px-3 py-2.5 text-right font-bold">
                                                        <span className={item.profit >= 0 ? "text-green-700" : "text-red-600"}>
                                                          {fmt(item.profit)}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                                <tfoot>
                                                  <tr className="bg-slate-50 text-sm font-semibold border-t-2">
                                                    <td colSpan={6} className="px-4 py-2.5 text-right text-muted-foreground">Total for this sale</td>
                                                    <td className="px-3 py-2.5 text-right">{fmt(entryRevenue)}</td>
                                                    <td className="px-3 py-2.5 text-right text-green-700">{fmt(entryProfit)}</td>
                                                  </tr>
                                                </tfoot>
                                              </table>
                                            </div>

                                            {/* Mobile cards */}
                                            <div className="md:hidden divide-y">
                                              {entry.items.map(item => (
                                                <div key={item.id} className="px-4 py-3 space-y-1.5">
                                                  <div className="flex items-start justify-between gap-2">
                                                    <span className="font-medium text-sm">{item.productName}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${TYPE_COLOR[item.saleType]}`}>
                                                      {TYPE_LABEL[item.saleType]}
                                                    </span>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span>Qty: <strong className="text-foreground">{item.quantity}</strong></span>
                                                    <span>Price: <strong className="text-foreground">{fmt(item.unitPrice)}</strong></span>
                                                    <span>Cost: <strong className="text-foreground">{fmt(item.costPrice)}</strong></span>
                                                    {item.repairFee > 0 && (
                                                      <span>Repair Fee: <strong className="text-amber-700">{fmt(item.repairFee)}</strong></span>
                                                    )}
                                                  </div>
                                                  <div className="flex justify-between items-center pt-1 border-t border-dashed">
                                                    <span className="text-xs text-muted-foreground">Revenue {fmt(item.totalRevenue)}</span>
                                                    <span className={`font-bold text-sm ${item.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                      {fmt(item.profit)} profit
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                              <div className="px-4 py-2.5 bg-slate-50 flex justify-between items-center text-sm font-semibold border-t-2">
                                                <span className="text-muted-foreground">Total for this sale</span>
                                                <div className="text-right">
                                                  <div>{fmt(entryRevenue)}</div>
                                                  <div className="text-green-700 text-xs">{fmt(entryProfit)} profit</div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

function DiaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: "green" | "blue" | "purple" | "amber";
}) {
  const bg = {
    green: "bg-gradient-to-br from-green-50 to-green-100/60 border-green-200",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/60 border-blue-200",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100/60 border-purple-200",
    amber: "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200",
  }[color];
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
      <p className="text-base sm:text-lg font-bold truncate">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}