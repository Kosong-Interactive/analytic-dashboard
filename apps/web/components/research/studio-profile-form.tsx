"use client";

import { useActionState } from "react";

import { updateStudioProfile, type StudioProfileActionState } from "@/app/settings/studio-fit/actions";
import {
  capabilityLabels,
  capabilityLevels,
  inputMethodLabels,
  inputMethodValues,
  monetizationLabels,
  monetizationValues,
  studioPlatformValues,
  type StudioProfileView,
} from "@/lib/research/studio-profile";

interface TaxonomyOption {
  type: string;
  slug: string;
  displayName: string;
}

const initialState: StudioProfileActionState = { ok: null };
const inputClass = "h-9 rounded-md border border-line-strong bg-surface-alt px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent";

function CheckGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-alt px-3 py-2 text-xs text-ink-soft">
          <input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} className="accent-accent" />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function StudioProfileForm({ profile, taxonomy }: { profile: StudioProfileView | null; taxonomy: TaxonomyOption[] }) {
  const [state, action, pending] = useActionState(updateStudioProfile, initialState);
  const preferred = profile?.preferredLabels ?? [];
  const avoided = profile?.avoidedLabels ?? [];
  const grouped = taxonomy.reduce<Record<string, TaxonomyOption[]>>((groups, label) => {
    (groups[label.type] ??= []).push(label);
    return groups;
  }, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <section className="rounded-[10px] border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Production envelope</h2>
        <p className="mt-1 text-xs text-dim">Context for feasibility reviews; these fields are not guessed from market labels.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-dim">Team size<input className={inputClass} type="number" name="teamSize" min={1} max={500} defaultValue={profile?.teamSize ?? 5} required /></label>
          <label className="flex flex-col gap-1 text-xs text-dim">Target duration (months)<input className={inputClass} type="number" name="targetDurationMonths" min={1} max={120} defaultValue={profile?.targetDurationMonths ?? 12} required /></label>
        </div>
        <div className="mt-4 flex flex-col gap-2"><p className="text-xs text-dim">Supported platforms</p><CheckGroup name="supportedPlatforms" selected={profile?.supportedPlatforms ?? ["google_play", "app_store"]} options={studioPlatformValues.map((value) => ({ value, label: value === "google_play" ? "Google Play" : "App Store" }))} /></div>
        <div className="mt-4 flex flex-col gap-2"><p className="text-xs text-dim">Input methods</p><CheckGroup name="inputMethods" selected={profile?.inputMethods ?? ["touch"]} options={inputMethodValues.map((value) => ({ value, label: inputMethodLabels[value] }))} /></div>
      </section>

      <section className="rounded-[10px] border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Capabilities</h2>
        <p className="mt-1 text-xs text-dim">Recorded explicitly and shown beside recommendations; not inferred automatically.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["capability2d", "2D art & production", profile?.capability2d],
            ["capability3d", "3D art & production", profile?.capability3d],
            ["onlineBackendCapability", "Online backend & multiplayer", profile?.onlineBackendCapability],
            ["contentProductionCapability", "Content production", profile?.contentProductionCapability],
            ["liveOpsCapability", "Live-ops", profile?.liveOpsCapability],
          ].map(([name, label, current]) => (
            <label key={name} className="flex flex-col gap-1 text-xs text-dim">{label}<select className={inputClass} name={name} defaultValue={current ?? "basic"}>{capabilityLevels.map((level) => <option key={level} value={level}>{capabilityLabels[level]}</option>)}</select></label>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2"><p className="text-xs text-dim">Monetization capabilities</p><CheckGroup name="monetizationCapabilities" selected={profile?.monetizationCapabilities ?? []} options={monetizationValues.map((value) => ({ value, label: monetizationLabels[value] }))} /></div>
      </section>

      <section className="rounded-[10px] border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Direction alignment</h2>
        <p className="mt-1 text-xs leading-5 text-dim">Only explicit matches affect Studio Fit. Leave a direction unchecked when the team is neutral.</p>
        {Object.entries(grouped).map(([type, labels]) => (
          <div key={type} className="mt-5 border-t border-line-soft pt-4">
            <h3 className="text-xs font-medium capitalize text-ink">{type.replaceAll("_", " ")}</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div><p className="mb-2 text-[11px] uppercase tracking-wider text-up">Preferred</p><CheckGroup name="preferredLabels" selected={preferred} options={labels.map((label) => ({ value: `${label.type}:${label.slug}`, label: label.displayName }))} /></div>
              <div><p className="mb-2 text-[11px] uppercase tracking-wider text-down">Avoided</p><CheckGroup name="avoidedLabels" selected={avoided} options={labels.map((label) => ({ value: `${label.type}:${label.slug}`, label: label.displayName }))} /></div>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save new profile version"}</button>
        {profile ? <span className="text-xs text-dim">Current version {profile.version}</span> : null}
        {state.ok === true ? <span className="text-xs text-up">Version {state.version} saved.</span> : null}
        {state.ok === false ? <span role="alert" className="text-xs text-down">{state.error}</span> : null}
      </div>
    </form>
  );
}
