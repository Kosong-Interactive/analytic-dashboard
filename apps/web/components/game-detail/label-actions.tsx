"use client";

import { useActionState } from "react";

import { changeLabel, type LabelActionState } from "@/app/games/[id]/actions";
import { changeSteamLabel } from "@/app/steam/games/[id]/actions";
import type { LabelStatus } from "@/lib/labels/resolve";

const initial: LabelActionState = { ok: null };
const buttonClass =
  "h-7 rounded-md border border-line-strong px-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-50";

export type EditableLabelTarget =
  | { kind: "mobile"; id: string }
  | { kind: "steam"; id: string; externalId: string };

/** Confirm, reject, or undo a decision on one label. Each button submits its own intent. */
export function LabelActions({
  target,
  labelId,
  status,
}: {
  target: EditableLabelTarget;
  labelId: string;
  status: LabelStatus;
}) {
  const action = target.kind === "steam" ? changeSteamLabel : changeLabel;
  const [state, formAction, pending] = useActionState(action, initial);
  const decided = status === "confirmed" || status === "rejected";

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={target.kind === "steam" ? "steamAppId" : "storeAppId"} value={target.id} />
      {target.kind === "steam" ? <input type="hidden" name="externalId" value={target.externalId} /> : null}
      <input type="hidden" name="labelId" value={labelId} />
      {status !== "confirmed" ? (
        <button type="submit" name="intent" value="confirm" disabled={pending} className={buttonClass}>
          Confirm
        </button>
      ) : null}
      {status !== "rejected" ? (
        <button type="submit" name="intent" value="reject" disabled={pending} className={buttonClass}>
          Reject
        </button>
      ) : null}
      {decided ? (
        <button type="submit" name="intent" value="clear" disabled={pending} className={buttonClass}>
          Undo my decision
        </button>
      ) : null}
      {pending ? <span className="text-[11px] text-dim">Saving…</span> : null}
      {state.ok === false ? (
        <span role="alert" className="text-[11px] text-down">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function AddLabelForm({
  target,
  options,
}: {
  target: EditableLabelTarget;
  options: Array<{ group: string; labels: Array<{ id: string; displayName: string }> }>;
}) {
  const action = target.kind === "steam" ? changeSteamLabel : changeLabel;
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name={target.kind === "steam" ? "steamAppId" : "storeAppId"} value={target.id} />
      {target.kind === "steam" ? <input type="hidden" name="externalId" value={target.externalId} /> : null}
      <input type="hidden" name="intent" value="confirm" />
      <label className="flex flex-col gap-1 text-[11px] text-dim">
        Add a label
        <select
          name="labelId"
          required
          defaultValue=""
          className="h-8 max-w-[16rem] rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <option value="" disabled>
            Choose a label…
          </option>
          {options.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-accent px-3 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state.ok === false ? (
        <span role="alert" className="text-xs text-down">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
