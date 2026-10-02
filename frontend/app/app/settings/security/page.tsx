import { redirect } from "next/navigation";

export default function AppSettingsSecurityRedirectPage() {
  redirect("/dashboard/settings/security");
}
