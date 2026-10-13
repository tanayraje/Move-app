// Returns a photo URL for a city. Read-only: it never touches the database.
// Deploy:  supabase functions deploy city-image
// Uses the same UNSPLASH_ACCESS_KEY secret as hero-image.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { city, hint } = await req.json();
    if (!city || typeof city !== "string") return json({ image: null, error: "city is required" }, 400);

    const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!key) return json({ image: null, error: "UNSPLASH_ACCESS_KEY is not set" }, 500);

    const place = [city, typeof hint === "string" ? hint : ""].join(" ").trim();
    // Most specific first, then looser fallbacks
    const queries = [`${place} city`, `${place} travel`, city];

    for (const query of queries) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("content_filter", "high");
      url.searchParams.set("per_page", "5");

      const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
      if (!res.ok) continue;

      const data = await res.json();
      const hit = data?.results?.[0];
      if (hit?.urls?.regular) {
        return json({
          image: hit.urls.regular,
          credit: { name: hit.user?.name ?? null, link: hit.user?.links?.html ?? null },
        });
      }
    }
    return json({ image: null });
  } catch (err) {
    return json({ image: null, error: String(err) }, 500);
  }
});
