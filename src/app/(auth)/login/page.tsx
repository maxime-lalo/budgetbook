import { LoginForm } from "./_components/login-form";
import { env } from "@/lib/env";

export const metadata = { title: "Connexion - Comptes" };

export default function LoginPage() {
  return <LoginForm registrationEnabled={env.REGISTRATION_ENABLED} />;
}
