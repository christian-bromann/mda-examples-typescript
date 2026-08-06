import { ChatApp } from "src/components/chat-app";
import { LoginScreen } from "src/components/login-screen";
import { useAuthHeaders } from "src/lib/auth/headers";
import { useBackendHealth } from "src/lib/backend-health";
import { useAuthSession } from "src/lib/auth/session";

function AuthConfigError() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">Supabase not configured</h1>
        <p className="text-sm text-muted-foreground">
          Set <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
          <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in{" "}
          <span className="font-mono">.env</span>, then restart the UI.
        </p>
      </div>
    </div>
  );
}

export function App() {
  const { authSession, loading, configured, signOut } = useAuthSession();
  const authHeaders = useAuthHeaders();
  const { status: backendStatus, apiUrl } = useBackendHealth(authSession !== null);

  if (!configured) {
    return <AuthConfigError />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (!authSession) {
    return <LoginScreen />;
  }

  return (
    <ChatApp
      userLabel={authSession.label}
      authHeaders={authHeaders}
      backendStatus={backendStatus}
      apiUrl={apiUrl}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
