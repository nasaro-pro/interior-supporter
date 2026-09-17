import { signOutAction } from "@/modules/membership";
import { messages } from "@/lib/messages";

export function LogoutButton({ className = "ghost-btn" }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        {messages.logout}
      </button>
    </form>
  );
}
