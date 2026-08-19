import { ChatApp } from "src/components/chat-app";
import { useBackendHealth } from "src/lib/backend-health";

export function App() {
  const { status: backendStatus, apiUrl } = useBackendHealth();

  return <ChatApp backendStatus={backendStatus} apiUrl={apiUrl} />;
}
