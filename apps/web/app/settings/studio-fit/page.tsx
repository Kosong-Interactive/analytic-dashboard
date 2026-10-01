import Link from "next/link";

import { StudioProfileForm } from "@/components/research/studio-profile-form";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { listTaxonomyOptions } from "@/lib/labels/manual-labels";
import { getStudioProfile } from "@/lib/research/studio-profile-service";

export const metadata = { title: "Studio Fit · Game Analytic" };

export default async function StudioFitSettingsPage() {
  await requireUser("/settings/studio-fit");
  const [profile, taxonomy] = await Promise.all([getStudioProfile(), listTaxonomyOptions()]);
  const relevant = taxonomy.filter((label) =>
    ["genre", "subgenre", "core_mechanic", "meta_mechanic", "theme"].includes(label.type),
  );
  return (
    <AppShell noCounterpart filters={{ country: "id", platform: "all" }} active="overview">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-dim underline-offset-2 hover:underline">← Back to Overview</Link>
        <h1 className="text-[26px] font-semibold tracking-tight">Studio Fit Profile</h1>
        <p className="text-[15px] text-dim">Versioned team capabilities and direction preferences used by studio_fit_v1.</p>
      </div>
      <StudioProfileForm profile={profile} taxonomy={relevant} />
      <p className="text-sm leading-5 text-dim">Saving creates a new immutable version. Market Opportunity remains separate, and Recommendation Priority appears only when both Market Opportunity and Studio Fit are measurable.</p>
    </AppShell>
  );
}
