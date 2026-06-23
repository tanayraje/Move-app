import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import TripDashboard from "@/pages/TripDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/trip/:id" component={TripDashboard} />
      <Route path="/trip/:id/:tab" component={TripDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
 useEffect(() => {
  /*if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });*/
    return;
  }

  if (import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
}, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    signInWithGoogle,
  } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-5xl font-display font-extrabold text-foreground tracking-tight mb-3">
            Move.
          </h1>

          <p className="text-muted-foreground text-lg mb-10">
            Plan trips together. Track expenses. Never miss a detail.
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full bg-primary text-primary-foreground rounded-2xl px-6 py-4 text-lg font-semibold shadow-xl"
          >
            <LogIn className="w-5 h-5 inline mr-2" />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default App;
