import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Trip } from "@/lib/types";

interface CityPoint {
  city: string;
  lat: number;
  lon: number;
}

function createNumberIcon(number: number) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: hsl(var(--primary));
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        ${number}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitBounds({ points }: { points: CityPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 8);
      return;
    }

    const bounds = L.latLngBounds(
      points.map(point => [point.lat, point.lon] as [number, number])
    );

    map.fitBounds(bounds, {
      padding: [35, 35],
      maxZoom: 8,
    });
  }, [map, points]);

  return null;
}

async function geocodeCity(city: string): Promise<CityPoint | null> {
  try {
    const cacheKey = `move-geocode:${city.trim().toLowerCase()}`;

    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (
        parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lon === "number"
      ) {
        return {
          city,
          lat: parsed.lat,
          lon: parsed.lon,
        };
      }
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
        city
      )}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (!data?.length) return null;

    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        lat,
        lon,
      })
    );

    return {
      city,
      lat,
      lon,
    };
  } catch {
    return null;
  }
}

export default function TripMap({ trip }: { trip: Trip }) {
  const [points, setPoints] = useState<CityPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const cities = useMemo(() => {
    const dayCities = trip.dayCities ?? {};

    return Object.entries(dayCities)
      .sort(([dateA], [dateB]) => {
        if (dateA.startsWith("Day ") && dateB.startsWith("Day ")) {
          const a = Number(dateA.replace("Day ", ""));
          const b = Number(dateB.replace("Day ", ""));
          return a - b;
        }

        return dateA.localeCompare(dateB);
      })
      .map(([, city]) => city.trim())
      .filter(Boolean)
      .filter((city, index, arr) => {
        const normalised = city.toLowerCase();

        return (
          arr.findIndex(
            item => item.toLowerCase() === normalised
          ) === index
        );
      });
  }, [trip.dayCities]);

  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      if (cities.length === 0) {
        setPoints([]);
        return;
      }

      setLoading(true);

      const results: CityPoint[] = [];

      for (const city of cities) {
        if (cancelled) return;

        const point = await geocodeCity(city);

        if (point) {
          results.push(point);
        }

        // Respect Nominatim's public rate limit.
        if (cities.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }

      if (!cancelled) {
        setPoints(results);
        setLoading(false);
      }
    }

    loadCities();

    return () => {
      cancelled = true;
    };
  }, [cities]);

  if (cities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Trip Route
        </p>

        <p className="text-sm text-muted-foreground">
          Add cities to your Timeline to see your trip route.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Trip Route
          </p>

          <p className="text-sm text-muted-foreground mt-1">
            {cities.length} {cities.length === 1 ? "city" : "cities"}
          </p>
        </div>

        {loading && (
          <span className="text-xs text-muted-foreground">
            Loading map…
          </span>
        )}
      </div>

      <div className="h-[260px] w-full">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom={false}
          dragging={true}
          zoomControl={true}
          attributionControl={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={points} />

          {points.length > 1 && (
            <Polyline
              positions={points.map(point => [
                point.lat,
                point.lon,
              ])}
              pathOptions={{
                color: "hsl(var(--primary))",
                weight: 3,
                opacity: 0.85,
              }}
            />
          )}

          {points.map((point, index) => (
            <Marker
              key={`${point.city}-${index}`}
              position={[point.lat, point.lon]}
              icon={createNumberIcon(index + 1)}
            >
              <Popup>
                <strong>{index + 1}. {point.city}</strong>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="px-4 py-3 border-t border-border/50">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {points.map((point, index) => (
            <div
              key={`${point.city}-label`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className="font-bold text-primary">
                {index + 1}
              </span>
              <span>{point.city}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}