import { SteamLabelPage } from "@/components/steam/label-page";
import { requireUser } from "@/lib/auth/session";
import { steamGenresPage, parseSteamLabelQuery } from "@/lib/steam/label-query";

export const metadata = { title: "Steam Genres · Game Analytic" };

interface SteamLabelRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamGenresPage({ searchParams }: SteamLabelRouteProps) {
  await requireUser("/steam/genres");
  const query = parseSteamLabelQuery(steamGenresPage, await searchParams);
  return (
    <SteamLabelPage
      config={steamGenresPage}
      query={query}
      active="steam-genres"
      title="Genres"
      intro="How tracked Steam games spread across genres and subgenres"
    />
  );
}
