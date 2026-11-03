import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// The public marketing site arrives in Phase 9. Until then "/" sends people where they belong.
export default async function Index() {
  const session = await getSession();
  redirect(session ? "/home" : "/sign-in");
}
