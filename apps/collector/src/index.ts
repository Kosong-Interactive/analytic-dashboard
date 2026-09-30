import { runClassifyAiCommand } from "./commands/classify-ai.js";
import { runClassifyCommand } from "./commands/classify.js";
import { runClassifySteamCommand } from "./commands/classify-steam.js";
import { runDiscoverSteamCommand } from "./commands/discover-steam.js";
import { runDiscoverCommand } from "./commands/discover.js";
import { runResearchCommand } from "./commands/research.js";
import { runResearchBriefCommand } from "./commands/research-brief.js";
import { createCollectorDescriptor } from "./descriptor.js";

const [command = "info", ...args] = process.argv.slice(2);

if (command === "info") {
  console.info(
    JSON.stringify({
      application: "mobile-game-collector",
      status: "foundation-ready",
      ...createCollectorDescriptor(),
    }),
  );
} else if (command === "discover") {
  try {
    process.exitCode = await runDiscoverCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discovery.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "discover-steam") {
  try {
    process.exitCode = await runDiscoverSteamCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "steam.discovery.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "classify") {
  try {
    process.exitCode = await runClassifyCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "classification.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "classify-steam") {
  try {
    process.exitCode = await runClassifySteamCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "classification.steam.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "classify-ai") {
  try {
    process.exitCode = await runClassifyAiCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "classification.ai.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "research") {
  try {
    process.exitCode = await runResearchCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "research.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else if (command === "research-brief") {
  try {
    process.exitCode = await runResearchBriefCommand(args);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "research.brief.failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
} else {
  console.error(`Unknown collector command: ${command}`);
  process.exitCode = 1;
}
