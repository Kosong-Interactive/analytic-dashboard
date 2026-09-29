import { LabelPage } from "@/components/labels/label-page";
import { requireUser } from "@/lib/auth/session";
import { mechanicsPage, parseLabelQuery } from "@/lib/labels/query";

export const metadata = { title: "Mechanics · Game Analytic" };

interface MechanicsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MechanicsPage({ searchParams }: MechanicsPageProps) {
  await requireUser("/mechanics");
  const query = parseLabelQuery(mechanicsPage, await searchParams);
  return (
    <LabelPage
      config={mechanicsPage}
      query={query}
      active="mechanics"
      title="Mechanics"
      intro="Core and meta mechanics, themes, and multiplayer modes across tracked games"
    />
  );
}
