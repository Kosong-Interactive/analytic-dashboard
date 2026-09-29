import { sql, type SQL } from "drizzle-orm";

import { appLabels, classificationRuns } from "../schema/index";

/**
 * Keeps a label row unless it is a rule label for an app that the AI has classified under the
 * same taxonomy version. The AI classifies against the whole vocabulary, so its result replaces
 * the app's rule labels (including rule false positives it did not repeat); manual labels are
 * unaffected and still take precedence.
 */
export function notSupersededByAi(): SQL {
  return sql`not (${appLabels.source} = 'rule' and exists (
    select 1 from ${classificationRuns}
    where ${classificationRuns.appId} = ${appLabels.appId}
      and ${classificationRuns.source} = 'ai'
      and ${classificationRuns.taxonomyVersion} = ${appLabels.taxonomyVersion}
  ))`;
}
