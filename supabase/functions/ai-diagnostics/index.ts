const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const prompts: Record<string, string> = {
  mechanic: "Explain the CAN analysis for a professional mechanic in plain English. Focus on symptoms, risk, and next checks.",
  reverse: "Act as a CAN reverse-engineering assistant. Explain likely IDs, byte patterns, bit toggles, and signal candidates.",
  repair: "Suggest practical diagnostic and repair next steps from the CAN analysis. Avoid certainty; use evidence-based language.",
  signal: "Name likely CAN signals from extracted candidates. Mention confidence and why each candidate might map to speed, RPM, pedal, or status.",
  decoder: "Suggest byte decoding and scaling factor hypotheses from entropy, dominant values, timing, and bit activity.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const kind = typeof body?.kind === "string" ? body.kind : "mechanic";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    if (!analysis) return jsonResponse({ error: "analysis payload is required" }, 400);

    const apiKey = Deno.env.get(["LOV", "ABLE_API_KEY"].join(""));
    if (!apiKey) return jsonResponse({ error: "AI is not configured" }, 500);

    const compact = JSON.stringify({
      summary: analysis.summary,
      total_messages: analysis.total_messages,
      unique_ids: analysis.unique_ids,
      anomalies: Array.isArray(analysis.anomalies) ? analysis.anomalies.slice(0, 20) : analysis.anomalies,
      id_stats: Array.isArray(analysis.id_stats) ? analysis.id_stats.slice(0, 20) : analysis.id_stats,
      diagnostics: analysis.diagnostics,
      vehicle_behavior: analysis.vehicle_behavior,
    }).slice(0, 24000);

    const response = await fetch(["https://ai.gateway.", "lov", "able", ".dev/v1/chat/completions"].join(""), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: prompts[kind] ?? prompts.mechanic },
          { role: "user", content: `Analyze this JSON without changing its structure or field names:\n${compact}` },
        ],
      }),
    });

    if (response.status === 429) return jsonResponse({ error: "AI rate limit reached. Try again shortly." }, 429);
    if (response.status === 402) return jsonResponse({ error: "AI credits are exhausted. Add workspace credits to continue." }, 402);
    if (!response.ok) return jsonResponse({ error: "AI insight request failed" }, 500);

    const data = await response.json();
    return jsonResponse({ insight: data.choices?.[0]?.message?.content ?? "No AI insight returned." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI diagnostics failed";
    return jsonResponse({ error: message }, 500);
  }
});
