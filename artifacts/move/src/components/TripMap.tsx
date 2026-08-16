import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  X,
  Maximize2,
  Locate,
} from "lucide-react";
import { Trip } from "@/lib/types";
import "leaflet/dist/leaflet.css";

interface CityPoint {
  city: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
}

function createNumberIcon(
  number: number,
  isCurrent: boolean = false,
  offsetX: number = 0
) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: ${isCurrent ? 34 : 30}px;
        height: ${isCurrent ? 34 : 30}px;
        border-radius: 9999px;
        background: hsl(var(--primary));
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        border: 3px solid white;
        box-shadow: 0 2px 9px rgba(0,0,0,0.25);
        transform: translateX(${offsetX}px);
        ${isCurrent ? "outline: 3px solid hsl(var(--primary) / 0.2);" : ""}
      ">
        ${number}
      </div>
    `,
    iconSize: [
      isCurrent ? 34 : 30,
      isCurrent ? 34 : 30,
    ],
    iconAnchor: [
      isCurrent ? 17 : 15,
      isCurrent ? 17 : 15,
    ],
  });
}


function FitBounds({
  points,
  fullscreen = false,
}: {
  points: CityPoint[];
  fullscreen?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const updateMap = () => {
      map.invalidateSize();

      if (points.length === 1) {
        map.setView(
          [points[0].lat, points[0].lon],
          fullscreen ? 9 : 8
        );
        return;
      }

      const bounds = L.latLngBounds(
        points.map(point => [
          point.lat,
          point.lon,
        ] as [number, number])
      );

      map.fitBounds(bounds, {
        padding: fullscreen ? [60, 60] : [35, 35],
        maxZoom: fullscreen ? 9 : 8,
      });
    };

    const timer = window.setTimeout(updateMap, 100);

    return () => window.clearTimeout(timer);
  }, [map, points, fullscreen]);

  return null;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

function RecenterButton({
  points,
  fullscreen = false,
}: {
  points: CityPoint[];
  fullscreen?: boolean;
}) {
  const map = useMap();

  const recenter = () => {
    if (points.length === 0) return;

    map.invalidateSize();

    if (points.length === 1) {
      map.setView(
        [points[0].lat, points[0].lon],
        fullscreen ? 9 : 8,
        { animate: true }
      );
      return;
    }

    const bounds = L.latLngBounds(
      points.map(point => [
        point.lat,
        point.lon,
      ] as [number, number])
    );

    map.fitBounds(bounds, {
      padding: fullscreen ? [60, 60] : [35, 35],
      maxZoom: fullscreen ? 9 : 8,
      animate: true,
    });
  };

  return (
    <button
  type="button"
  onClick={recenter}
  aria-label="Recenter map"
  className="
    absolute
    top-3
    right-3
    z-[1000]
    w-9
    h-9
    rounded-full
    border border-white/20
    bg-black/30
    backdrop-blur-xl
    flex items-center justify-center
    text-white
    shadow-lg shadow-black/10
    hover:bg-black/40
    active:scale-95
    transition-all
  "
>
  <Locate className="w-4 h-4" strokeWidth={2} />
</button>
  );
}

function formatDistance(km: number) {
  if (km < 1) return "<1 km";

  if (km < 100) {
    return `${Math.round(km)} km`;
  }

  return `${Math.round(km).toLocaleString("en-IN")} km`;
}

function formatStayDate(date: string) {
  if (!date) return "";

  // Wishlist format
  if (date.startsWith("Day ")) {
    return date;
  }

  // Calendar format: YYYY-MM-DD → 12 Aug
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return date;

  const d = new Date(year, month - 1, day);

  return format(d, "d MMM");
}

async function geocodeCity(
  city: string
): Promise<{ lat: number; lon: number } | null> {
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
        return parsed;
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

    const result = { lat, lon };

    localStorage.setItem(
      cacheKey,
      JSON.stringify(result)
    );

    return result;
  } catch {
    return null;
  }
}

function MapContent({
  points,
  currentCity,
  fullscreen,
}: {
  points: CityPoint[];
  currentCity?: string;
  fullscreen?: boolean;
}) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds
        points={points}
        fullscreen={fullscreen}
        />

        <RecenterButton
        points={points}
        fullscreen={fullscreen}
        />

      {points.length > 1 &&
        points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];

          return (
            <React.Fragment
              key={`segment-${index}`}
            >
              <Polyline
                positions={[
                  [point.lat, point.lon],
                  [next.lat, next.lon],
                ]}
                pathOptions={{
                  color: "hsl(var(--primary))",
                  weight: 3,
                  opacity: 0.85,
                }}
              />

            </React.Fragment>
          );
        })}

      {points.map((point, index) => {
  const isCurrent =
    !!currentCity &&
    point.city.toLowerCase() ===
      currentCity.toLowerCase();

  const sameCityPoints = points.filter(
    p =>
      p.city.toLowerCase() ===
      point.city.toLowerCase()
  );

  const occurrenceIndex = sameCityPoints.findIndex(
    p => p === point
  );

  const markerOffset =
    sameCityPoints.length > 1
      ? (occurrenceIndex -
          (sameCityPoints.length - 1) / 2) *
        36
      : 0;

  return (
    <Marker
      key={`${point.city}-${index}`}
      position={[point.lat, point.lon]}
      icon={createNumberIcon(
        index + 1,
        isCurrent,
        markerOffset
      )}
    >
  <Popup>
  <div className="text-sm">
    <strong>
      {index + 1}. {point.city}
    </strong>

    <div className="mt-1 text-xs">
  {point.startDate === point.endDate
    ? formatStayDate(point.startDate)
    : `${formatStayDate(point.startDate)} – ${formatStayDate(point.endDate)}`}
</div>

    {isCurrent && (
      <div className="mt-1 text-xs font-semibold">
        Current city
      </div>
    )}
  </div>
</Popup>
</Marker>
        );
      })}
    </>
  );
}

export default function TripMap({
  trip,
}: {
  trip: Trip;
}) {
  const [points, setPoints] = useState<CityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const cities = useMemo(() => {
    const dayCities = trip.dayCities ?? {};

    const entries = Object.entries(dayCities)
      .sort(([dateA], [dateB]) => {
        if (
          dateA.startsWith("Day ") &&
          dateB.startsWith("Day ")
        ) {
          return (
            Number(dateA.replace("Day ", "")) -
            Number(dateB.replace("Day ", ""))
          );
        }

        return dateA.localeCompare(dateB);
      });

const unique: {
  city: string;
  startDate: string;
  endDate: string;
}[] = [];

for (const [date, rawCity] of entries) {
  const city = rawCity.trim();

  if (!city) continue;

  const lastStay = unique[unique.length - 1];

  // Same city as the previous timeline day.
  // Extend the current stay.
  if (
    lastStay &&
    lastStay.city.toLowerCase() === city.toLowerCase()
  ) {
    lastStay.endDate = date;
  } else {
    // City changed, so start a new stay.
    unique.push({
      city,
      startDate: date,
      endDate: date,
    });
  }
}

return unique;
  }, [trip.dayCities]);

  const currentCity = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    return trip.dayCities?.[todayKey] || "";
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

      for (const entry of cities) {
        if (cancelled) return;

        const coordinates = await geocodeCity(
          entry.city
        );

        if (coordinates) {
          results.push({
            city: entry.city,
            startDate: entry.startDate,
            endDate: entry.endDate,
            lat: coordinates.lat,
            lon: coordinates.lon,
            });
        }

        if (cities.length > 1) {
          await new Promise(resolve =>
            setTimeout(resolve, 1100)
          );
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

  const totalDistance = useMemo(() => {
    return points
      .slice(0, -1)
      .reduce((total, point, index) => {
        const next = points[index + 1];

        return (
          total +
          haversineDistance(
            point.lat,
            point.lon,
            next.lat,
            next.lon
          )
        );
      }, 0);
  }, [points]);

  if (cities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Trip Route
        </p>

        <p className="text-sm text-muted-foreground mt-1">
          Add cities to your Timeline to see your
          trip route.
        </p>
      </div>
    );
  }

    return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[9999] bg-background"
          : "relative z-0 isolate bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
      }
    >
      <div
  className={
  fullscreen
    ? "absolute top-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-b border-border flex items-center justify-between px-5 py-4"
    : "px-4 pt-4 pb-3 flex items-center justify-between"
}
>
  <div>
    <p
      className={
        fullscreen
          ? "text-base font-bold text-foreground"
          : "text-xs font-bold uppercase tracking-wider text-muted-foreground"
      }
    >
      Trip Route
    </p>

    <p className="text-sm text-muted-foreground mt-1">
      {cities.length}{" "}
      {cities.length === 1 ? "city" : "cities"}
      {totalDistance > 0 && (
        <>
          {" · "}
          {formatDistance(totalDistance)}
        </>
      )}
    </p>
  </div>

  {!fullscreen && (
    <button
      type="button"
      onClick={() => setFullscreen(true)}
      className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0"
    >
      <Maximize2 className="w-3.5 h-3.5" />
      Full map
    </button>
  )}

  {fullscreen && (
    <button
      type="button"
      onClick={() => setFullscreen(false)}
      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"
      aria-label="Close map"
    >
      <X className="w-5 h-5" />
    </button>
  )}
</div>

      <div
        className={
          fullscreen
            ? "absolute inset-0 pt-[73px]"
            : "h-[260px] w-full"
        }
      >
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom={fullscreen}
          dragging={true}
          zoomControl={true}
          attributionControl={true}
          className="h-full w-full"
        >
          <MapContent
            points={points}
            currentCity={currentCity}
            fullscreen={fullscreen}
          />
        </MapContainer>
      </div>

      <div
        className={
          fullscreen
            ? "absolute bottom-5 left-4 right-4 z-[1000]"
            : "px-4 py-3 border-t border-border/50"
        }
      >
        <div
          className={
            fullscreen
              ? "bg-background/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-lg"
              : ""
          }
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {points.map((point, index) => (
              <div
                key={`${point.city}-label`}
                className="flex items-center gap-1.5"
              >
                <span className="text-xs font-bold text-primary">
                  {index + 1}
                </span>

                <span className="text-xs font-medium text-foreground">
                  {point.city}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}