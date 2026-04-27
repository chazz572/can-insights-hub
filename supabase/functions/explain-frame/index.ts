// Edge function: AI-powered "Explain This Frame".
// Accepts a single CAN frame (+ optional context) and returns a structured
// explanation via the Lovable AI Gateway. Public function — no JWT required.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface FramePayload {
  id?: number | string;
  bus?: number | string;
  dlc?: number;
  data?: number[];
  timestamp?: number | string;
  hz?: number;
  count?: number;
  heuristic?: {
    subsystem?: string;
    confidence?: number;
    reasons?: string[];
    status?: string;
    tags?: string[];
  };
}

const SYSTEM_PROMPT = `You are an automotive CAN bus diagnostics expert.
You receive ONE CAN frame plus optional heuristic context.
Respond ONLY by calling the provided function with structured fields.
Be concise, practical, and avoid certainty when evidence is weak.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => null)) as { frame?: FramePayload } | null;
    const frame = body?.frame;
    if (!frame || frame.id === undefined) return json({ error: "frame.id is required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);

    const idNum = typeof frame.id === "string" ? Number(frame.id) : frame.id;
    const idHex = `0x${(idNum as number).toString(16).toUpperCase()}`;
    const dataHex = (frame.data ?? []).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

    const userMessage = [
      `CAN frame:`,
      `- ID: ${idHex} (${idNum})`,
      `- Bus: ${frame.bus ?? "0"}`,
      `- DLC: ${frame.dlc ?? frame.data?.length ?? 0}`,
      `- Data (hex): ${dataHex || "(empty)"}`,
      frame.hz ? `- Observed cadence: ${frame.hz.toFixed(1)} Hz` : null,
      frame.count ? `- Observed count in window: ${frame.count}` : null,
      frame.heuristic ? `- Heuristic guess: ${frame.heuristic.subsystem} (confidence ${(((frame.heuristic.confidence ?? 0) * 100) | 0)}%, status ${frame.heuristic.status ?? "normal"})` : null,
      frame.heuristic?.reasons?.length ? `- Heuristic reasons: ${frame.heuristic.reasons.join(" | ")}` : null,
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [{
          type: "function",
          function: {
            name: "explain_frame",
            description: "Return a structured explanation of a single CAN frame.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "1-2 sentence plain-English explanation." },
                probable_subsystem: { type: "string", description: "Best-guess subsystem (e.g. Powertrain (ECM), Brakes/ABS, BCM, BMS, EV Inverter)." },
                status: { type: "string", enum: ["normal", "suspicious", "anomalous"] },
                confidence: { type: "number", description: "0..1 confidence in the subsystem guess." },
                possible_signals: { type: "array", items: { type: "string" }, description: "Signals this frame might carry (e.g. wheel speed FL/FR, throttle position)." },
                vehicle_implications: { type: "string", description: "What this frame might mean for vehicle behavior or faults." },
                next_steps: { type: "array", items: { type: "string" }, description: "Concrete diagnostic / verification steps." },
              },
              required: ["summary", "probable_subsystem", "status", "confidence", "possible_signals", "vehicle_implications", "next_steps"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "explain_frame" } },
      }),
    });

    if (resp.status === 429) return json({ error: "AI rate limit reached. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits are exhausted. Add workspace credits to continue." }, 402);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("AI gateway error:", resp.status, text);
      return json({ error: "AI explain-frame request failed." }, 500);
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    let explanation: Record<string, unknown> | null = null;
    if (call?.function?.arguments) {
      try { explanation = JSON.parse(call.function.arguments); } catch { /* fallthrough */ }
    }
    if (!explanation) {
      const fallback = data.choices?.[0]?.message?.content ?? "";
      return json({
        summary: fallback || "AI did not return a structured explanation.",
        probable_subsystem: frame.heuristic?.subsystem ?? "Unknown",
        status: frame.heuristic?.status ?? "normal",
        confidence: frame.heuristic?.confidence ?? 0.2,
        possible_signals: [],
        vehicle_implications: "Insufficient evidence to draw a strong conclusion from a single frame.",
        next_steps: ["Capture more frames with the same ID and compare payload changes."],
      });
    }
    return json(explanation);
  } catch (e) {
    console.error("explain-frame error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
