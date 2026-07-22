import { writeFileSync } from "node:fs";
import { IrysClient } from "@irys/js/node";
import { PRIVATE_KEY, IRYS_NODE_URL, TX_ID_FILE } from "./config.js";
import {
  uploadDataV1,
  waitForFinalized,
  waitForLocalOffset,
} from "./dataTxV1.js";

const artifact = {
  kind: "inference-log",
  model: "demo",
  prompt: "Summarize Irys programmable data in one sentence.",
  output:
    "Irys stores data on L1 and lets IrysVM contracts read it via Programmable Data.",
  createdAt: new Date().toISOString(),
};

async function main(): Promise<void> {
  const data = Buffer.from(JSON.stringify(artifact));

  console.log(`node: ${IRYS_NODE_URL}`);
  const irys = await new IrysClient().node(IRYS_NODE_URL);

  const { txId, length, dataHex } = await uploadDataV1(irys, PRIVATE_KEY, data);
  console.log(`uploaded txId=${txId} bytes=${length}`);

  await waitForFinalized(irys, txId);
  const localOffset = await waitForLocalOffset(irys, txId);

  writeFileSync(
    TX_ID_FILE,
    JSON.stringify(
      { txId, length, dataHex, localOffset: localOffset?.toString() ?? null, artifact },
      null,
      2
    )
  );
  console.log(`wrote ${TX_ID_FILE}`);
  console.log(`https://gateway.irys.xyz/${txId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
