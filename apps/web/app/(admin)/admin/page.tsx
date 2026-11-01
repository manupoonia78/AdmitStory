import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function AdminHome() {
  await requireAdminPage();
  redirect("/admin/schools");
}
