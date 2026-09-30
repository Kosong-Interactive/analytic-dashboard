import { SteamLabelPage } from "@/components/steam/label-page";
import { requireUser } from "@/lib/auth/session";
import { steamMechanicsPage, parseSteamLabelQuery } from "@/lib/steam/label-query";

export const metadata = { title: "Steam Mechanics · Game Analytic" };

interface SteamLabelRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamMechanicsPage({ searchParams }: SteamLabelRouteProps) {
  await requireUser("/steam/mechanics");
  const query = parseSteamLabelQuery(steamMechanicsPage, await searchParams);
  return (
    <SteamLabelPage
      config={steamMechanicsPage}
      query={query}
      active="steam-mechanics"
      title="Mechanics"
      intro="Mechanics, themes, and multiplayer modes across tracked Steam games"
    />
  );
}
