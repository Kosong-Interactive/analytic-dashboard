import { Panel } from "./panel";

export function ClassificationPending() {
  return (
    <Panel
      title="Genres and mechanics"
      description="Trending genres and emerging mechanics"
    >
      <p className="border-t border-line-soft px-4 py-5 text-xs leading-5 text-dim">
        Not available yet. These views aggregate AI and rule-based labels, which arrive with the
        classification phase. Until then the tables above use each store&apos;s own category.
      </p>
    </Panel>
  );
}
