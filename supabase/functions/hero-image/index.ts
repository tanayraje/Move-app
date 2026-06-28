import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { trip_id, destination } = await req.json();

    if (!trip_id || !destination) {
      return Response.json(
        { error: "trip_id and destination are required" },
        { status: 400 }
      );
    }

    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");

    if (!accessKey) {
      return Response.json(
        { error: "Missing UNSPLASH_ACCESS_KEY" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        `${destination} travel`
      )}&orientation=landscape&per_page=1`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    );

    const data = await response.json();

    const image = data.results?.[0]?.urls?.regular;

    if (!image) {
      return Response.json({ image: null });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("trips")
      .update({
        hero_image: image,
      })
      .eq("id", trip_id);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      image,
    });
  } catch (err) {
    return Response.json(
      {
        error: String(err),
      },
      { status: 500 }
    );
  }
});