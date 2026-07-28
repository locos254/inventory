import { useState } from "react";
import { 
  useGetBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
  useGetModels,
  getGetModelsQueryKey,
  useCreateModel,
  useUpdateModel,
  useDeleteModel,
  Brand,
  PhoneModel
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

export default function BrandsAndModels() {
  const queryClient = useQueryClient();
  const { data: brands, isLoading: brandsLoading } = useGetBrands();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const { data: models, isLoading: modelsLoading } = useGetModels(
    { brandId: selectedBrandId ?? undefined }, 
    { query: { enabled: !!selectedBrandId, queryKey: getGetModelsQueryKey({ brandId: selectedBrandId ?? undefined }) } }
  );

  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();

  // Brand Edit State
  const [editingBrandId, setEditingBrandId] = useState<number | 'new' | null>(null);
  const [editBrandName, setEditBrandName] = useState("");

  // Model Edit State
  const [editingModelId, setEditingModelId] = useState<number | 'new' | null>(null);
  const [editModelName, setEditModelName] = useState("");

  // Brand Actions
  const handleSaveBrand = async (id: number | 'new') => {
    if (!editBrandName.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (id === 'new') {
        const brand = await createBrand.mutateAsync({ data: { name: editBrandName } });
        toast.success("Brand created");
        setSelectedBrandId(brand.id);
      } else {
        await updateBrand.mutateAsync({ id, data: { name: editBrandName } });
        toast.success("Brand updated");
      }
      setEditingBrandId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
    } catch (e: any) {
      toast.error(e?.error?.error || "Error saving brand");
    }
  };

  const handleDeleteBrand = (id: number) => {
    Swal.fire({
      title: 'Delete Brand?',
      text: "Models associated with this brand will also be affected.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteBrand.mutate({ id }, {
          onSuccess: () => {
            toast.success("Brand deleted");
            if (selectedBrandId === id) setSelectedBrandId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
          }
        });
      }
    });
  };

  // Model Actions
  const handleSaveModel = async (id: number | 'new') => {
    if (!selectedBrandId) return;
    if (!editModelName.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (id === 'new') {
        await createModel.mutateAsync({ data: { name: editModelName, brandId: selectedBrandId } });
        toast.success("Model created");
      } else {
        await updateModel.mutateAsync({ id, data: { name: editModelName, brandId: selectedBrandId } });
        toast.success("Model updated");
      }
      setEditingModelId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    } catch (e: any) {
      toast.error(e?.error?.error || "Error saving model");
    }
  };

  const handleDeleteModel = (id: number) => {
    Swal.fire({
      title: 'Delete Model?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteModel.mutate({ id }, {
          onSuccess: () => {
            toast.success("Model deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/models"] });
          }
        });
      }
    });
  };

  return (
    <Layout title="Brands & Models">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
        
        {/* Brands Panel */}
        <Card className="shadow-none border-border flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b flex-shrink-0">
            <CardTitle className="text-base">Brands</CardTitle>
            <Button onClick={() => { setEditingBrandId('new'); setEditBrandName(''); }} disabled={editingBrandId === 'new'} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Brand
            </Button>
          </CardHeader>
          <div className="flex-1 overflow-auto bg-slate-50/50">
            <table className="sheets-table w-full">
              <tbody>
                {editingBrandId === 'new' && (
                  <tr className="bg-primary/5">
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Input autoFocus value={editBrandName} onChange={e => setEditBrandName(e.target.value)} placeholder="Brand Name" className="h-8 flex-1 bg-white" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 shrink-0" onClick={() => handleSaveBrand('new')}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setEditingBrandId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                )}
                
                {brandsLoading ? (
                  <tr><td className="text-center py-6 text-muted-foreground">Loading...</td></tr>
                ) : brands?.map(b => (
                  <tr 
                    key={b.id} 
                    className={`cursor-pointer transition-colors ${selectedBrandId === b.id ? 'bg-primary/10 hover:bg-primary/10' : 'hover:bg-slate-100'}`}
                    onClick={() => { if (editingBrandId !== b.id) setSelectedBrandId(b.id); }}
                  >
                    <td className="p-0">
                      {editingBrandId === b.id ? (
                        <div className="flex gap-2 p-2 bg-primary/5" onClick={e => e.stopPropagation()}>
                          <Input autoFocus value={editBrandName} onChange={e => setEditBrandName(e.target.value)} className="h-8 flex-1 bg-white" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 shrink-0" onClick={() => handleSaveBrand(b.id)}><Check className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setEditingBrandId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3">
                          <span className={`font-medium ${selectedBrandId === b.id ? 'text-primary' : 'text-foreground'}`}>
                            {b.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" 
                              onClick={(e) => { e.stopPropagation(); setEditingBrandId(b.id); setEditBrandName(b.name); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteBrand(b.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <ChevronRight className={`h-4 w-4 ml-2 transition-colors ${selectedBrandId === b.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Models Panel */}
        <Card className="shadow-none border-border flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b flex-shrink-0">
            <CardTitle className="text-base">
              {selectedBrandId ? `${brands?.find(b => b.id === selectedBrandId)?.name} Models` : 'Select a Brand'}
            </CardTitle>
            <Button 
              onClick={() => { setEditingModelId('new'); setEditModelName(''); }} 
              disabled={!selectedBrandId || editingModelId === 'new'} 
              size="sm" 
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> New Model
            </Button>
          </CardHeader>
          <div className="flex-1 overflow-auto bg-slate-50/50">
            {!selectedBrandId ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                <ChevronRight className="h-8 w-8 opacity-20" />
                Select a brand to view its models
              </div>
            ) : (
              <table className="sheets-table w-full">
                <tbody>
                  {editingModelId === 'new' && (
                    <tr className="bg-primary/5">
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Input autoFocus value={editModelName} onChange={e => setEditModelName(e.target.value)} placeholder="Model Name" className="h-8 flex-1 bg-white" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 shrink-0" onClick={() => handleSaveModel('new')}><Check className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setEditingModelId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {modelsLoading ? (
                    <tr><td className="text-center py-6 text-muted-foreground">Loading...</td></tr>
                  ) : models?.length === 0 && editingModelId !== 'new' ? (
                    <tr><td className="text-center py-6 text-muted-foreground">No models found for this brand.</td></tr>
                  ) : models?.map(m => (
                    <tr key={m.id} className="hover:bg-slate-100 group">
                      <td className="p-0">
                        {editingModelId === m.id ? (
                          <div className="flex gap-2 p-2 bg-primary/5">
                            <Input autoFocus value={editModelName} onChange={e => setEditModelName(e.target.value)} className="h-8 flex-1 bg-white" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 shrink-0" onClick={() => handleSaveModel(m.id)}><Check className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setEditingModelId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3">
                            <span className="font-medium text-foreground">{m.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingModelId(m.id); setEditModelName(m.name); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteModel(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
