import fs from "node:fs/promises";
import path from "node:path";
import wabtFactory from "wabt";

const root = process.cwd();
const watPath = path.join(root, "src", "wasm", "lod.wat");
const wasmDir = path.join(root, "public", "wasm");
const wasmPath = path.join(wasmDir, "lod.wasm");

const wabt = await wabtFactory();
const wat = await fs.readFile(watPath, "utf8");
const module = wabt.parseWat(watPath, wat);
const { buffer } = module.toBinary({
  log: false,
  write_debug_names: true
});

await fs.mkdir(wasmDir, { recursive: true });
await fs.writeFile(wasmPath, Buffer.from(buffer));
console.log(`built ${path.relative(root, wasmPath)}`);
