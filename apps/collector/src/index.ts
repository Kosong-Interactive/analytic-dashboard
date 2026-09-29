import { createCollectorDescriptor } from "./descriptor.js";

const command = process.argv[2] ?? "info";

if (command !== "info") {
  console.error(`Unknown collector command: ${command}`);
  process.exitCode = 1;
} else {
  console.info(
    JSON.stringify({
      application: "mobile-game-collector",
      status: "foundation-ready",
      ...createCollectorDescriptor(),
    }),
  );
}
