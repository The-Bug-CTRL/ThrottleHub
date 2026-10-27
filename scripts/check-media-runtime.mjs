// Local process/disk probe only; does not read or write cloud data.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = tmpdir(),
  folder = await mkdtemp(path.join(root, "throttlehub-runtime-"));
try {
  for (const [name, binary] of [
    ["ffmpeg", process.env.FFMPEG_PATH || "ffmpeg"],
    ["ffprobe", process.env.FFPROBE_PATH || "ffprobe"],
  ]) {
    const { stdout } = await promisify(execFile)(binary, ["-version"], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 100000,
    });
    console.log(name + ": " + stdout.split("\n")[0]);
  }
  await writeFile(path.join(folder, "probe"), "local runtime test");
  const disk = await statfs(folder),
    free = disk.bavail * disk.bsize;
  console.log(
    JSON.stringify({
      node: process.version,
      tmpWritable: true,
      tmpFreeMiB: Math.floor(free / 1024 / 1024),
      localOnly: true,
      timeout: "Route maxDuration is not proof of a host-enforced timeout.",
    }),
  );
  if (free < 512 * 1024 * 1024)
    throw Error("Less than 512 MiB temporary headroom.");
} finally {
  if (
    path.dirname(folder) !== root ||
    !path.basename(folder).startsWith("throttlehub-runtime-")
  )
    throw Error("Unexpected temp path");
  await rm(folder, { recursive: true, force: true });
}
