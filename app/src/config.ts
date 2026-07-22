import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), "..", ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env var ${name}`);
  }
  return v.trim();
}

export const PRIVATE_KEY = required("PRIVATE_KEY");
export const EXECUTION_RPC = required("EXECUTION_RPC");
export const IRYS_NODE_URL =
  process.env.IRYS_NODE_URL?.trim() || "https://testnet-rpc.irys.xyz/v1";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? "1270");
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS?.trim() ?? "";
export const TX_ID_FILE = resolve(process.cwd(), "last-upload.json");
