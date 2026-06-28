import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { trip_id, destination } = await req.json();

    if (!trip_id || !destination) {
      return Response.json(
        { error: "trip_id and destination are required" },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!accessKey) {
      return Response.json(
        { error: "Missing UNSPLASH_ACCESS_KEY" },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        {
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        `${destination} travel`
      )}&orientation=landscape&per_page=1`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    );

    if (!unsplashResponse.ok) {
      return Response.json(
        {
          error: "Unsplash request failed",
          status: unsplashResponse.status,
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const data = await unsplashResponse.json();

    const image = data.results?.[0]?.urls?.regular;

    if (!image) {
      return Response.json(
        {
          image: null,
        },
        {
          headers: corsHeaders,
        }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data, error } = await supabase
  .from("trips")
  .update({
    hero_image: image,
  })
  .eq("id", trip_id)
  .select();

return Response.json(
  {
    trip_id,
    image,
    updated: data,
    error,
  },
  {
    headers: corsHeaders,
  }
);
    }

    return Response.json(
      {
        image,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (err) {
  console.error(err);

  return Response.json(
    {
      error: String(err),
      stack: err instanceof Error ? err.stack : null,
    },
    {
      status: 500,
      headers: corsHeaders,
    }
  );
}