import { runClassifyCommand } from "./commands/classify.js";
import { runDiscoverCommand } from "./commands/discover.js";
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
} else {
  console.error(`Unknown collector command: ${command}`);
  process.exitCode = 1;
}
