import { signIn } from "@/auth";
import { DemoSignIn } from "@/components/DemoSignIn";

export default function SignInPage() {
  async function authenticate(form: FormData) { "use server"; await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/dashboard" }); }
  return <div className="auth-wrap"><div><div className="brand" style={{ color: "#172033" }}><span className="brand-mark" style={{ border: "1px solid #d0d5dd" }}>SVI</span><div><strong>Internal Accounts Payable</strong><small>Database-backed workflow simulation</small></div></div><DemoSignIn action={authenticate} /></div></div>;
}
