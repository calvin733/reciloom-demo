import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script through npm.");

const commands = {
  install: [
    [".", ["ci", "--include=dev"]],
    ["backend", ["ci", "--include=dev"]],
    ["frontend", ["ci", "--include=dev"]],
  ],
  build: [
    ["backend", ["run", "db:generate"]],
    ["backend", ["run", "build"]],
    ["frontend", ["run", "build"]],
  ],
};

const tasks = commands[process.argv[2]];
if (!tasks) throw new Error("Choose install or build.");
for (const [directory, args] of tasks) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: resolve(root, directory), stdio: "inherit", env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
