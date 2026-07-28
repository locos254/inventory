import { useState } from "react";
import { 
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  Category
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

export default function Categories() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useGetCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description || "");
  };

  const handleNew = () => {
    setEditingId('new');
    setEditName("");
    setEditDesc("");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (id: number | 'new') => {
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      if (id === 'new') {
        await createCategory.mutateAsync({ data: { name: editName, description: editDesc } });
        toast.success("Category created");
      } else {
        await updateCategory.mutateAsync({ id, data: { name: editName, description: editDesc } });
        toast.success("Category updated");
      }
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    } catch (e: any) {
      toast.error(e?.error?.error || "Error saving category");
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Delete Category?',
      text: "Products in this category will lose their category assignment.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCategory.mutate({ id }, {
          onSuccess: () => {
            toast.success("Category deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
          }
        });
      }
    });
  };

  return (
    <Layout title="Categories">
      <Card className="shadow-none border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base">Product Categories</CardTitle>
          <Button onClick={handleNew} disabled={editingId === 'new'} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Category
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="sheets-table">
            <thead>
              <tr>
                <th className="w-1/4">Name</th>
                <th className="w-1/2">Description</th>
                <th className="text-right">Products</th>
                <th className="text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editingId === 'new' && (
                <tr className="bg-primary/5">
                  <td>
                    <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Category Name" className="h-8" />
                  </td>
                  <td>
                    <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" className="h-8" />
                  </td>
                  <td className="text-right text-muted-foreground">-</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSave('new')}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Loading...</td></tr>
              ) : categories?.length === 0 && editingId !== 'new' ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No categories found.</td></tr>
              ) : (
                categories?.map(c => (
                  <tr key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <td><Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-8" /></td>
                        <td><Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-8" /></td>
                        <td className="text-right">{c.productCount || 0}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSave(c.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-medium text-foreground">{c.name}</td>
                        <td className="text-muted-foreground">{c.description || '-'}</td>
                        <td className="text-right">{c.productCount || 0}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
