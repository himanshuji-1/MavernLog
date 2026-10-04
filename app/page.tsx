import { redirect } from "next/navigation";

// Proxy sends signed-out users to /login; everyone else lands on Today.
export default function Home() {
  redirect("/today");
}
