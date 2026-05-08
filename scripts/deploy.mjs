import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const distDir = resolve(root, "dist");
const configPath = resolve(root, ".deploy-vaults.json");

const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const pluginId = manifest.id;

if (!existsSync(distDir) || readdirSync(distDir).length === 0) {
	console.error(`dist/ is empty or missing — run \`mise run build\` first.`);
	process.exit(1);
}

const expandHome = (p) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : p);

const loadVaults = () => {
	if (!existsSync(configPath)) return [];
	try {
		const data = JSON.parse(readFileSync(configPath, "utf8"));
		return Array.isArray(data.vaults) ? data.vaults : [];
	} catch {
		return [];
	}
};

const saveVaults = (vaults) => {
	writeFileSync(configPath, JSON.stringify({ vaults }, null, "\t") + "\n");
};

const isVault = (p) => existsSync(join(p, ".obsidian"));

const deployTo = (vaultPath) => {
	const target = join(vaultPath, ".obsidian", "plugins", pluginId);
	mkdirSync(target, { recursive: true });
	cpSync(distDir, target, { recursive: true });
	console.log(`  ✓ ${target}`);
};

const rl = createInterface({ input, output });

try {
	const vaults = loadVaults();

	console.log("Deploy CT Obsidian Formatter");
	console.log("");

	if (vaults.length > 0) {
		console.log("Saved vaults:");
		vaults.forEach((v, i) => console.log(`  ${i + 1}) ${v}`));
		console.log(`  a) all of the above`);
		console.log(`  n) enter a new vault path`);
		console.log(`  q) cancel`);
		console.log("");
	}

	const promptText = vaults.length > 0
		? "Choose vault [a]: "
		: "Obsidian vault path (q to cancel): ";

	let answer = (await rl.question(promptText)).trim();
	if (answer === "" && vaults.length > 0) answer = "a";
	if (answer === "q" || answer === "Q") {
		console.log("Cancelled.");
		process.exit(0);
	}

	let targets = [];

	if (answer === "a" && vaults.length > 0) {
		targets = vaults.slice();
	} else if (/^\d+$/.test(answer) && vaults.length > 0) {
		const idx = parseInt(answer, 10) - 1;
		if (idx < 0 || idx >= vaults.length) {
			console.error(`Invalid choice: ${answer}`);
			process.exit(1);
		}
		targets = [vaults[idx]];
	} else {
		const raw = answer === "n" ? (await rl.question("New vault path: ")).trim() : answer;
		if (!raw) {
			console.error("No vault path provided.");
			process.exit(1);
		}
		const expanded = resolve(expandHome(raw));
		if (!isVault(expanded)) {
			console.error(`Not an Obsidian vault (no .obsidian/ found): ${expanded}`);
			process.exit(1);
		}
		targets = [expanded];
		if (!vaults.includes(expanded)) {
			saveVaults([...vaults, expanded]);
			console.log(`  saved to ${configPath}`);
		}
	}

	console.log("");
	console.log(`Deploying to ${targets.length} vault(s):`);
	for (const v of targets) {
		if (!isVault(v)) {
			console.error(`  ✗ skipping (not a vault): ${v}`);
			continue;
		}
		deployTo(v);
	}
} finally {
	rl.close();
}
