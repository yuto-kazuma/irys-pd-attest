import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { ethers } from "ethers";
import {
  PRIVATE_KEY,
  EXECUTION_RPC,
} from "./config.js";

const require = createRequire(import.meta.url);
const solc = require("solc");

const contractsDir = resolve(process.cwd(), "..", "contracts", "src");

function loadSources(): Record<string, { content: string }> {
  const sources: Record<string, { content: string }> = {};
  for (const name of readdirSync(contractsDir)) {
    if (!name.endsWith(".sol")) continue;
    sources[name] = {
      content: readFileSync(join(contractsDir, name), "utf-8"),
    };
  }
  return sources;
}

function compile(): { abi: any[]; bytecode: string } {
  const input = {
    language: "Solidity",
    sources: loadSources(),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode"] },
      },
    },
  };

  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors?.length) {
    const fatal = out.errors.filter((e: any) => e.severity === "error");
    for (const e of out.errors) console.error(e.formattedMessage || e.message);
    if (fatal.length) throw new Error("compile failed");
  }

  const c = out.contracts["VerifiableAI.sol"]["VerifiableAI"];
  return { abi: c.abi, bytecode: c.evm.bytecode.object };
}

async function main(): Promise<void> {
  const { abi, bytecode } = compile();
  if (!bytecode || bytecode === "0x") throw new Error("empty bytecode");

  const provider = new ethers.JsonRpcProvider(EXECUTION_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`deployer ${wallet.address}`);
  console.log(`balance ${ethers.formatEther(await provider.getBalance(wallet.address))}`);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`deployed ${address}`);

  // Persist into root .env for subsequent scripts.
  const envPath = resolve(process.cwd(), "..", ".env");
  let env = readFileSync(envPath, "utf-8");
  if (/^CONTRACT_ADDRESS=.*/m.test(env)) {
    env = env.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
  } else {
    env += `\nCONTRACT_ADDRESS=${address}\n`;
  }
  writeFileSync(envPath, env);
  writeFileSync(
    resolve(process.cwd(), "contract.json"),
    JSON.stringify({ address, abi }, null, 2)
  );
  console.log("updated .env CONTRACT_ADDRESS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
