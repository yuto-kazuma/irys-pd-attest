import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { VERIFIABLE_AI_ABI } from "./abi.js";
import { EXECUTION_RPC, CONTRACT_ADDRESS, TX_ID_FILE } from "./config.js";

async function main(): Promise<void> {
  if (!CONTRACT_ADDRESS) throw new Error("Set CONTRACT_ADDRESS in .env");

  const { txId } = JSON.parse(readFileSync(TX_ID_FILE, "utf-8")) as {
    txId: string;
  };
  const id = BigInt(process.argv[2] ?? "0");

  const url = `https://gateway.irys.xyz/${txId}`;
  console.log(`fetch ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const localHash = ethers.keccak256(bytes);

  const provider = new ethers.JsonRpcProvider(EXECUTION_RPC);
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    VERIFIABLE_AI_ABI,
    provider
  );

  const [onChainHash] = await contract.attestations(id);
  const matches: boolean = await contract.verify(id, localHash);

  console.log(`id=${id} bytes=${bytes.length}`);
  console.log(`local    ${localHash}`);
  console.log(`on-chain ${onChainHash}`);
  console.log(matches ? "verified" : "not verified");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
