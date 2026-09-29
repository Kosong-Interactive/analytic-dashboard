import { LabelPage } from "@/components/labels/label-page";
import { requireUser } from "@/lib/auth/session";
import { genresPage, parseLabelQuery } from "@/lib/labels/query";

export const metadata = { title: "Genres · Game Analytic" };

interface GenresPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GenresPage({ searchParams }: GenresPageProps) {
  await requireUser("/genres");
  const query = parseLabelQuery(genresPage, await searchParams);
  return (
    <LabelPage
      config={genresPage}
      query={query}
      active="genres"
      title="Genres"
      intro="How tracked games spread across genres and subgenres"
    />
  );
}
