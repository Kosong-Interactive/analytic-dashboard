import type { GameDetailView } from "@/lib/games/view-model";

import { EmptyState, Panel } from "../overview/panel";
import { ScoreComponentsTable } from "../overview/score-breakdown";

export function ScorePanel({ view }: { view: GameDetailView }) {
  const { score } = view;
  return (
    <Panel
      title="Trend score breakdown"
      description={`${score.formulaVersion} · internal momentum score, not an official store label`}
    >
      {score.value === null ? (
        <EmptyState title="Not scored yet">
          {score.note ?? "There is not enough history to score this game."}
        </EmptyState>
      ) : (
        <div className="border-t border-line-soft px-4 pb-4 text-sm">
          <p className="pt-3 text-dim">
            Compared with {score.cohortSize ?? "?"} games in the same store and country. Based on{" "}
            {Math.round(score.weightCoverage * 100)}% of the score weight; unmeasurable components are left out, not
            counted as zero.
          </p>
          <ScoreComponentsTable components={score.components} score={score.value} />
        </div>
      )}
    </Panel>
  );
}
