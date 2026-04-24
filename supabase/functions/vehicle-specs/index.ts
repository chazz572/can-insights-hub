const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  name: "vehicle_specs",
  description: "Realistic real-world performance specs for the given vehicle.",
  parameters: {
    type: "object",
    properties: {
      canonical_name: { type: "string", description: "e.g. '2024 Ford Mustang GT (5.0L Coyote)'" },
      powertrain: { type: "string", enum: ["bev", "phev", "hybrid", "ice", "diesel"] },
      top_speed_kph: { type: "number" },
      zero_to_100_kph_sec: { type: "number" },
      sixty_to_130_mph_sec: { type: "number" },
      redline_rpm: { type: "number" },
      idle_rpm: { type: "number" },
      gear_count: { type: "integer" },
      gear_ratios: { type: "array", items: { type: "number" }, description: "1st through Nth gear ratios" },
      final_drive: { type: "number" },
      pack_kwh: { type: "number", description: "0 for pure ICE" },
      nominal_pack_volts: { type: "number", description: "12 for ICE, ~400/800 for EV" },
      peak_power_hp: { type: "number" },
      peak_torque_nm: { type: "number" },
      curb_weight_kg: { type: "number" },
      induction: { type: "string", enum: ["na", "turbo", "twin_turbo", "supercharged", "electric"] },
      drivetrain: { type: "string", enum: ["fwd", "rwd", "awd"] },
      tire_radius_m: { type: "number", description: "Loaded tire radius in meters, typical ~0.32-0.42" },
      notes: { type: "string", description: "One short sentence noting trim/year assumptions." },
    },
    required: [
      "canonical_name", "powertrain", "top_speed_kph", "zero_to_100_kph_sec",
      "redline_rpm", "gear_count", "peak_power_hp", "peak_torque_nm",
      "curb_weight_kg", "induction", "drivetrain", "tire_radius_m",
    ],
    additionalProperties: false,
  },
};

const SYSTEM = `You are an automotive specs database. Given a vehicle description (any year/trim/make/model), return realistic, public-knowledge ballpark performance specs as a tool call.
- Use the most likely current/recent trim if year is missing.
- Be accurate to within ~5-10%. Do NOT invent extreme numbers.
- For EVs set redline_rpm to motor max (~16000-20000), gear_count usually 1 (Taycan/e-tron GT = 2).
- For ICE/diesel set pack_kwh=0 and nominal_pack_volts=12.
- gear_ratios should be plausible (1st gear ~3-5, top gear ~0.6-1.0). final_drive ~3.0-5.5.
- tire_radius_m: compact 0.31, sedan/sport 0.34, SUV 0.38, truck 0.41.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!description) return jsonResponse({ error: "description is required" }, 400);
    if (description.length > 200) return jsonResponse({ error: "description too long" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "AI is not configured" }, 500);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Vehicle: ${description}\n\nReturn realistic specs via the vehicle_specs tool.` },
        ],
        tools: [{ type: "function", function: SCHEMA }],
        tool_choice: { type: "function", function: { name: "vehicle_specs" } },
      }),
    });

    if (response.status === 429) return jsonResponse({ error: "AI rate limit reached. Try again shortly." }, 429);
    if (response.status === 402) return jsonResponse({ error: "AI credits exhausted. Add workspace credits to continue." }, 402);
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error", response.status, t);
      return jsonResponse({ error: "AI specs lookup failed" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const argStr = toolCall?.function?.arguments;
    if (!argStr) return jsonResponse({ error: "No specs returned" }, 500);

    let specs: Record<string, unknown>;
    try {
      specs = JSON.parse(argStr);
    } catch {
      return jsonResponse({ error: "Malformed specs response" }, 500);
    }

    return jsonResponse({ specs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vehicle specs lookup failed";
    return jsonResponse({ error: message }, 500);
  }
});
