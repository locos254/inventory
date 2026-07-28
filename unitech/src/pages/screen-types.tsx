import { useState } from "react";
import { 
  useGetScreenTypes,
  useCreateScreenType,
  useUpdateScreenType,
  useDeleteScreenType,
  ScreenType
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

export default function ScreenTypes() {
  const queryClient = useQueryClient();
  const { data: screenTypes, isLoading } = useGetScreenTypes();
  const createScreenType = useCreateScreenType();
  const updateScreenType = useUpdateScreenType();
  const deleteScreenType = useDeleteScreenType();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editName, setEditName] = useState("");

  const handleEdit = (st: ScreenType) => {
    setEditingId(st.id);
    setEditName(st.name);
  };

  const handleNew = () => {
    setEditingId('new');
    setEditName("");
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
        await createScreenType.mutateAsync({ data: { name: editName } });
        toast.success("Screen Type created");
      } else {
        await updateScreenType.mutateAsync({ id, data: { name: editName } });
        toast.success("Screen Type updated");
      }
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/screen-types"] });
    } catch (e: any) {
      toast.error(e?.error?.error || "Error saving screen type");
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Delete Screen Type?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteScreenType.mutate({ id }, {
          onSuccess: () => {
            toast.success("Screen Type deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/screen-types"] });
          }
        });
      }
    });
  };

  return (
    <Layout title="Screen Types">
      <Card className="shadow-none border-border max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base">Screen Types</CardTitle>
          <Button onClick={handleNew} disabled={editingId === 'new'} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Type
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="sheets-table">
            <thead>
              <tr>
                <th className="w-full">Name</th>
                <th className="text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editingId === 'new' && (
                <tr className="bg-primary/5">
                  <td>
                    <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Type Name" className="h-8 max-w-sm" />
                  </td>
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
                <tr><td colSpan={2} className="text-center py-6 text-muted-foreground">Loading...</td></tr>
              ) : screenTypes?.length === 0 && editingId !== 'new' ? (
                <tr><td colSpan={2} className="text-center py-6 text-muted-foreground">No screen types found.</td></tr>
              ) : (
                screenTypes?.map(st => (
                  <tr key={st.id}>
                    {editingId === st.id ? (
                      <>
                        <td><Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-8 max-w-sm" /></td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSave(st.id)}>
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
                        <td className="font-medium text-foreground">{st.name}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(st)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(st.id)}>
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
