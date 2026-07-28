import { useState, useMemo, useEffect } from "react";
import { 
  useGetProducts, 
  useDeleteProduct, 
  useCreateProduct, 
  useUpdateProduct,
  useGetCategories,
  useGetBrands,
  useGetModels,
  getGetModelsQueryKey,
  useGetScreenTypes,
  GetProductsParams,
  Product,
  GetProductsSortOrder,
  GetProductsStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

function formatCurrency(amount: number) {
  return "KSh " + new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

// Radix (Sheet/Dialog) and SweetAlert2 both toggle styles (pointer-events,
// overflow) on <body> when they open/close, and don't know about each other.
// If a Swal confirm closes while/after a Sheet has touched the body, the
// body can get stuck with `pointer-events: none`, which makes the whole
// page (including the "New Product" sheet) look fine but be unclickable.
// This forces a clean reset any time our own sheet closes.
function useBodyLockCleanup(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  }, [isOpen]);
}

export default function Products() {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<GetProductsParams>({
    page: 1, limit: 50, sortBy: "createdAt", sortOrder: "desc" as GetProductsSortOrder
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useBodyLockCleanup(isSheetOpen);

  const { data: pageData, isLoading } = useGetProducts(params);
  const { data: categories } = useGetCategories();
  const { data: brands } = useGetBrands();
  const { data: screenTypes } = useGetScreenTypes();
  const deleteProduct = useDeleteProduct();

  const handleSort = (key: keyof Product) => {
    setSortConfig(prev => {
      if (prev?.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  const sortedProducts = useMemo(() => {
    if (!pageData?.products) return [];
    let sortableItems = [...pageData.products];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (aVal === null) aVal = undefined;
        if (bVal === null) bVal = undefined;
        if ((aVal ?? "") < (bVal ?? "")) return sortConfig.direction === 'asc' ? -1 : 1;
        if ((aVal ?? "") > (bVal ?? "")) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [pageData?.products, sortConfig]);

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Delete Product?',
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      // Belt-and-braces: make sure Swal's own body lock is fully cleared
      // before we do anything else, regardless of confirm/cancel.
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";

      if (result.isConfirmed) {
        deleteProduct.mutate({ id }, {
          onSuccess: () => {
            toast.success("Product deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          }
        });
      }
    });
  };

  const openNew = () => {
    setEditingProduct(null);
    setIsSheetOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setIsSheetOpen(true);
  };

  return (
    <Layout title="Inventory">
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search barcode, name..." 
              className="pl-9 bg-white"
              value={params.search || ""}
              onChange={e => setParams({ ...params, search: e.target.value, page: 1 })}
            />
          </div>
          <select 
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={params.categoryId || ""}
            onChange={e => setParams({ ...params, categoryId: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
          >
            <option value="">All Categories</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={params.brandId || ""}
            onChange={e => setParams({ ...params, brandId: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
          >
            <option value="">All Brands</option>
            {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select 
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={params.status || ""}
            onChange={e => setParams({ ...params, status: (e.target.value as GetProductsStatus) || undefined, page: 1 })}
          >
            <option value="">All Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
        <Button onClick={openNew} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        <div className="flex-1 overflow-auto">
          <table className="sheets-table">
            <thead>
              <tr>
                {[
                  { key: 'barcode', label: 'Barcode' },
                  { key: 'name', label: 'Product' },
                  { key: 'brandName', label: 'Brand' },
                  { key: 'categoryName', label: 'Category' },
                  { key: 'screenTypeName', label: 'Screen Type' },
                  { key: 'modelName', label: 'Model' },
                  { key: 'costPrice', label: 'Cost', align: 'right' },
                  { key: 'sellingPrice', label: 'Retail Price', align: 'right' },
                  { key: 'wholesalePrice', label: 'Wholesale', align: 'right' },
                  { key: 'quantity', label: 'Stock', align: 'right' },
                  { key: 'status', label: 'Status' }
                ].map(col => (
                  <th 
                    key={col.key} 
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                    onClick={() => handleSort(col.key as keyof Product)}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      {col.label}
                      {sortConfig?.key === col.key && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="text-center py-8">Loading...</td></tr>
              ) : sortedProducts.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">No products found.</td></tr>
              ) : (
                sortedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="font-mono text-xs">{product.barcode}</td>
                    <td className="font-medium">{product.name}</td>
                    <td>{product.brandName || '-'}</td>
                    <td>{product.categoryName || '-'}</td>
                    <td>{product.screenTypeName || '-'}</td>
                    <td>{product.modelName || '-'} {product.modelNumber ? `(${product.modelNumber})` : ''}</td>
                    <td className="text-right">{formatCurrency(product.costPrice)}</td>
                    <td className="text-right font-medium">{formatCurrency(product.sellingPrice)}</td>
                    <td className="text-right text-blue-700 font-medium">
                      {product.wholesalePrice != null ? formatCurrency(product.wholesalePrice) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="text-right font-medium">{product.quantity}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          product.status === 'in_stock' ? 'bg-green-500' :
                          product.status === 'low_stock' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-muted-foreground capitalize">
                          {product.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(product)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageData && pageData.totalPages > 1 && (
          <div className="border-t bg-slate-50 p-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground px-2">
              Showing {pageData.products.length} of {pageData.total} products
            </span>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={pageData.page === 1}
                onClick={() => setParams({ ...params, page: pageData.page - 1 })}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                disabled={pageData.page === pageData.totalPages}
                onClick={() => setParams({ ...params, page: pageData.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ProductFormSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
        product={editingProduct} 
      />
    </Layout>
  );
}

function ProductFormSheet({ isOpen, onClose, product }: { isOpen: boolean, onClose: () => void, product: Product | null }) {
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const { data: categories } = useGetCategories();
  const { data: brands } = useGetBrands();
  const { data: screenTypes } = useGetScreenTypes();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const wpRaw = fd.get("wholesalePrice") as string;
    const data = {
      name: fd.get("name") as string,
      brandId: fd.get("brandId") ? Number(fd.get("brandId")) : null,
      categoryId: fd.get("categoryId") ? Number(fd.get("categoryId")) : null,
      screenTypeId: fd.get("screenTypeId") ? Number(fd.get("screenTypeId")) : null,
      modelId: fd.get("modelId") ? Number(fd.get("modelId")) : null,
      modelNumber: (fd.get("modelNumber") as string) || null,
      costPrice: Number(fd.get("costPrice")),
      sellingPrice: Number(fd.get("sellingPrice")),
      wholesalePrice: wpRaw && wpRaw !== "" ? Number(wpRaw) : null,
      quantity: Number(fd.get("quantity")),
      minStockLevel: Number(fd.get("minStockLevel")),
      description: (fd.get("description") as string) || null,
    };

    if (product) {
      updateProduct.mutate({ id: product.id, data }, {
        onSuccess: () => {
          toast.success("Product updated");
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          onClose();
        },
        onError: () => toast.error("Failed to update product")
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: () => {
          toast.success("Product created");
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          onClose();
        },
        onError: () => toast.error("Failed to create product")
      });
    }
  };

  const [selectedBrand, setSelectedBrand] = useState<number | null>(product?.brandId || null);
  const { data: models } = useGetModels({ brandId: selectedBrand ?? undefined }, { query: { enabled: !!selectedBrand, queryKey: getGetModelsQueryKey({ brandId: selectedBrand ?? undefined }) } });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product ? "Edit Product" : "New Product"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Name *</label>
            <Input name="name" defaultValue={product?.name} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select name="categoryId" defaultValue={product?.categoryId || ""} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Screen Type</label>
              <select name="screenTypeId" defaultValue={product?.screenTypeId || ""} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">None</option>
                {screenTypes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <select 
                name="brandId" 
                value={selectedBrand || ""} 
                onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">None</option>
                {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Model</label>
              <select name="modelId" defaultValue={product?.modelId || ""} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" disabled={!selectedBrand}>
                <option value="">None</option>
                {models?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model Number / Code</label>
            <Input name="modelNumber" defaultValue={product?.modelNumber || ""} />
          </div>

          <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cost Price *</label>
                <Input name="costPrice" type="number" step="0.01" min="0" defaultValue={product?.costPrice ?? 0} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Retail Price *</label>
                <Input name="sellingPrice" type="number" step="0.01" min="0" defaultValue={product?.sellingPrice ?? 0} required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-1.5">
                Wholesale Price
                <span className="text-xs font-normal text-muted-foreground">(Fundi / bulk price — optional)</span>
              </label>
              <Input name="wholesalePrice" type="number" step="0.01" min="0" 
                defaultValue={product?.wholesalePrice ?? ""}
                placeholder="Leave empty if same as retail" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity in Stock *</label>
              <Input name="quantity" type="number" min="0" defaultValue={product?.quantity ?? 0} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Stock Level *</label>
              <Input name="minStockLevel" type="number" min="0" defaultValue={product?.minStockLevel ?? 5} required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea 
              name="description" 
              defaultValue={product?.description || ""} 
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
              {product ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}