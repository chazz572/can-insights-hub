import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const { email, password } = await req.json();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin" },
  });
  if (error && (error as any).code === "email_exists") {
    const list = await admin.auth.admin.listUsers();
    const existing = list.data.users.find((u) => u.email === email);
    if (existing) {
      const upd = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      data = upd.data as any;
      error = upd.error;
    }
  }
  return new Response(JSON.stringify({ data, error }), {
    headers: { "Content-Type": "application/json" },
    status: error ? 400 : 200,
  });
});
