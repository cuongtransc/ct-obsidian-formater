import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync(resolve(root, "manifest.json"), JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync(resolve(root, "versions.json"), "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync(resolve(root, "versions.json"), JSON.stringify(versions, null, "\t"));
