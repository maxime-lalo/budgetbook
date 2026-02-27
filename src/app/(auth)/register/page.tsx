import { redirect } from "next/navigation";
import { RegisterForm } from "./_components/register-form";
import { env } from "@/lib/env";

export const metadata = { title: "Inscription - Comptes" };

export default function RegisterPage() {
  if (!env.REGISTRATION_ENABLED) {
    redirect("/login");
  }

  return <RegisterForm />;
}
