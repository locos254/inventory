import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChangePassword } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import toast from "react-hot-toast";

const passSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(6, "Must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Required")
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

type PassForm = z.infer<typeof passSchema>;

export default function Settings() {
  const changePassword = useChangePassword();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PassForm>({
    resolver: zodResolver(passSchema)
  });

  const onSubmit = (data: PassForm) => {
    changePassword.mutate({
      data: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      }
    }, {
      onSuccess: () => {
        toast.success("Password changed successfully");
        reset();
      },
      onError: (err: any) => {
        toast.error(err?.error?.error || "Failed to change password");
      }
    });
  };

  return (
    <Layout title="Settings">
      <Card className="max-w-md shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Change Admin Password
          </CardTitle>
          <CardDescription>
            Update your administrator password here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <Input type="password" {...register("currentPassword")} className={errors.currentPassword ? "border-destructive" : ""} />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" {...register("newPassword")} className={errors.newPassword ? "border-destructive" : ""} />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input type="password" {...register("confirmPassword")} className={errors.confirmPassword ? "border-destructive" : ""} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={changePassword.isPending} className="mt-4">
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
