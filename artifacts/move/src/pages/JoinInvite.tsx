import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, differenceInDays } from "date-fns";
import { safeParseDate } from "@/lib/utils";

export default function JoinInvite() {
  const [, params] = useRoute("/join/:inviteCode");

  const inviteCode = params?.inviteCode || "";

  const { data: trip, isLoading } = useQuery({
    queryKey: ["invite-trip", inviteCode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_trip_by_invite_code",
        {
          code: inviteCode,
        }
      );

      if (error) throw error;

      return data?.[0] || null;
    },
    enabled: !!inviteCode,
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite Not Found</h1>
          <p className="text-muted-foreground">
            This invite link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const startDate = safeParseDate(trip.start_date);
  const endDate = safeParseDate(trip.end_date);

  const duration =
    startDate && endDate
      ? differenceInDays(endDate, startDate) + 1
      : null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-3">
          Join Trip
        </h1>

        <p className="text-center text-muted-foreground mb-6">
  You've been invited to join a trip by{" "}
  <span className="font-semibold text-foreground">
    {trip.owner_name}
  </span>.
</p>

        <div className="bg-card border border-border rounded-3xl p-5">
          <h2 className="text-2xl font-bold mb-1">
            {trip.name}
          </h2>

          <p className="text-muted-foreground mb-4">
            {trip.destination}
          </p>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Dates</span>
              <div className="font-medium">
                {startDate && endDate
                  ? `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`
                  : "Not set"}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground">Duration</span>
              <div className="font-medium">
                {duration ? `${duration} Days` : "Not set"}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="font-medium capitalize">
                {trip.status}
              </div>
            </div>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full mt-4"
        >
          Join Trip
        </Button>
        
      </div>
    </div>
    
  );
}
