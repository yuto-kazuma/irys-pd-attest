import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { IrysClient } from "@irys/js/node";
import { VERIFIABLE_AI_ABI } from "./abi.js";
import {
  PRIVATE_KEY,
  EXECUTION_RPC,
  IRYS_NODE_URL,
  CONTRACT_ADDRESS,
  TX_ID_FILE,
} from "./config.js";

async function main(): Promise<void> {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Set CONTRACT_ADDRESS in .env");
  }

  const { txId, length, dataHex } = JSON.parse(
    readFileSync(TX_ID_FILE, "utf-8")
  ) as { txId: string; length: number; dataHex: string };

  console.log(`attest txId=${txId} bytes=${length}`);

  const irys = await new IrysClient().node(IRYS_NODE_URL);

  // PD access lists need /tx/{id}/local/data_start_offset on a node that
  // actually stores the chunks. Public RPC often finalizes the header but
  // returns 404 here.
  const offsetRes = await irys.api.get(`/tx/${txId}/local/data_start_offset`);
  if (offsetRes.status !== 200) {
    throw new Error(
      `No local data offset for ${txId} (HTTP ${offsetRes.status}). ` +
        `Header may be FINALIZED, but this node does not expose chunk offsets ` +
        `needed to build a PD access list. Ask in Discord which public endpoint ` +
        `stores ingress data / exposes data_start_offset.`
    );
  }

  const accessList = await irys.programmableData
    .read(txId, 0, length)
    .toAccessList();

  const provider = new ethers.JsonRpcProvider(EXECUTION_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    VERIFIABLE_AI_ABI,
    wallet
  );

  const populated = await contract.attest.populateTransaction();
  const sent = await wallet.sendTransaction({
    ...populated,
    accessList: [accessList],
    type: 2,
    maxFeePerGas: ethers.parseUnits("50", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    gasLimit: 10_000_000n,
  });

  console.log(`tx ${sent.hash}`);
  const receipt = await sent.wait();
  console.log(`block ${receipt?.blockNumber}`);

  const count: bigint = await contract.attestationCount();
  const id = count - 1n;
  const [onChainHash, storedLen] = await contract.attestations(id);
  const localHash = ethers.keccak256("0x" + dataHex);

  console.log(`id=${id}`);
  console.log(`on-chain ${onChainHash}`);
  console.log(`local    ${localHash}`);
  console.log(`length   ${storedLen} (local ${length})`);
  console.log(
    onChainHash.toLowerCase() === localHash.toLowerCase()
      ? "match"
      : "mismatch"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
