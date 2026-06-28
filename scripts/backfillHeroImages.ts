import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: trips } = await supabase
    .from("trips")
    .select("id,destination");

  if (!trips) return;

  for (const trip of trips) {
    console.log(`Updating ${trip.destination}...`);

    await supabase.functions.invoke("hero-image", {
      body: {
        trip_id: trip.id,
        destination: trip.destination,
      },
    });
  }

  console.log("Done!");
}

run();