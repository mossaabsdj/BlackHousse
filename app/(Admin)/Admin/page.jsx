import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import AdminDashboard from "@/app/component/Admin/AdminDashboard";
export default async function AdminPage() {
  const session = await getServerSession(authOptions);
console.log("AdminPage session:", session);
  if (!session) {
    redirect("/Login?callbackUrl=/Admin");
  }

  if (session.user?.role !== "ADMIN") {
    redirect("/");
  }

  return <AdminDashboard />;
}
