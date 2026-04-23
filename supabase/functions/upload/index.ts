import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonResponse({ error: "CSV file is required" }, 400);
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return jsonResponse({ error: "Only CSV files allowed" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const fileId = crypto.randomUUID();
    const storagePath = `${fileId}.csv`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("can-csv-uploads")
      .upload(storagePath, bytes, {
        contentType: file.type || "text/csv",
        upsert: false,
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { error: metadataError } = await supabase.from("can_uploads").insert({
      file_id: fileId,
      filename: file.name,
      storage_path: storagePath,
      content_type: file.type || "text/csv",
      file_size: file.size,
    });

    if (metadataError) throw new Error(`Upload metadata save failed: ${metadataError.message}`);

    return jsonResponse({ file_id: fileId, filename: file.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return jsonResponse({ error: message }, 500);
  }
});
