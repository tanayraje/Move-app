import { useRoute } from "wouter";

export default function JoinInvite() {
  const [, params] = useRoute("/join/:inviteCode");

  const inviteCode = params?.inviteCode || "";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-3xl font-bold mb-3">Join Trip</h1>

        <p className="text-muted-foreground mb-6">
          You've been invited to join a trip.
        </p>

        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Invite Code
          </p>

          <p className="text-xl font-bold tracking-wider">
            {inviteCode}
          </p>
        </div>
      </div>
    </div>
  );
}