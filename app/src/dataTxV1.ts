import { createHash } from "node:crypto";
import { encode as rlpEncode } from "rlp";
import bs58 from "bs58";
import {
  SigningKey,
  computeAddress,
  encodeBase58,
  getBytes,
  hexlify,
  keccak256,
  recoverAddress,
} from "ethers";

const DATA_TX_VERSION = 1;

function sha256(data: Uint8Array): Uint8Array {
  return createHash("sha256").update(data).digest();
}

function encodeVersionedList(version: number, fields: any[]): Uint8Array {
  return Uint8Array.from(rlpEncode([version, ...fields] as any));
}

export type UploadedDataTx = {
  txId: string;
  length: number;
  dataHex: string;
};

/**
 * Native L1 data upload using DataTransactionHeader V1.
 * Published @irys/js@0.0.2 still builds V0 headers; testnet rejects those.
 */
export async function uploadDataV1(
  irys: any,
  privateKey: string,
  data: Buffer
): Promise<UploadedDataTx> {
  const unsigned = irys.createTransaction();
  await unsigned.prepareChunks(data);

  const priceRes = await irys.api.get(`/price/0/${data.length}`);
  if (priceRes.status !== 200) {
    throw new Error(
      `price failed: ${priceRes.status} ${JSON.stringify(priceRes.data)}`
    );
  }
  const permFee = BigInt(priceRes.data.permFee);
  const termFee = BigInt(priceRes.data.termFee);

  const latest = await irys.api.get("/block/latest");
  if (latest.status !== 200 || !latest.data?.blockHash) {
    throw new Error(`block/latest failed: ${latest.status}`);
  }
  const anchorBytes = Uint8Array.from(bs58.decode(latest.data.blockHash));
  if (anchorBytes.length !== 32) throw new Error("bad anchor length");

  const signingKey = new SigningKey(privateKey);
  const signer = getBytes(computeAddress(signingKey.publicKey));
  const dataRoot = unsigned.dataRoot as Uint8Array;
  const dataSize = BigInt(unsigned.dataSize);
  const prefixSize = 0n;
  const prefixHash = sha256(new Uint8Array(0));
  const ledgerId = 0;
  const chainId = 1270n;
  const metadataFormat = 0;

  const fields = [
    anchorBytes,
    signer,
    dataRoot,
    dataSize,
    prefixSize,
    prefixHash,
    termFee,
    ledgerId,
    chainId,
    metadataFormat,
    permFee,
  ];

  const prehash = getBytes(
    keccak256(encodeVersionedList(DATA_TX_VERSION, fields))
  );
  const sig = signingKey.sign(prehash);
  const signature = getBytes(sig.serialized);
  const id = getBytes(keccak256(sig.serialized));

  const recovered = getBytes(recoverAddress(prehash, hexlify(signature)));
  if (Buffer.compare(Buffer.from(recovered), Buffer.from(signer)) !== 0) {
    throw new Error("signature recovery mismatch");
  }

  const header = {
    version: DATA_TX_VERSION,
    id: encodeBase58(id),
    anchor: encodeBase58(anchorBytes),
    signer: encodeBase58(signer),
    dataRoot: encodeBase58(dataRoot),
    dataSize: dataSize.toString(),
    prefixSize: prefixSize.toString(),
    prefixHash: encodeBase58(prefixHash),
    termFee: termFee.toString(),
    ledgerId,
    chainId: chainId.toString(),
    signature: encodeBase58(signature),
    metadataFormat,
    permFee: permFee.toString(),
  };

  const post = await irys.api.post("/tx", JSON.stringify(header), {
    headers: { "Content-Type": "application/json" },
  });
  if (post.status !== 200) {
    throw new Error(
      `upload header failed: ${post.status} ${JSON.stringify(post.data)}`
    );
  }

  // Chunk upload still works off the merkle tree (keyed by dataRoot).
  unsigned.termFee = termFee;
  unsigned.permFee = permFee;
  const signed = await unsigned.sign(privateKey);
  await signed.uploadChunks(data);

  return {
    txId: header.id,
    length: data.length,
    dataHex: data.toString("hex"),
  };
}

export async function waitForFinalized(
  irys: any,
  txId: string,
  timeoutMs = 300_000
): Promise<void> {
  const start = Date.now();
  process.stdout.write("waiting for finalized");
  while (Date.now() - start < timeoutMs) {
    const res = await irys.api.get(`/tx/${txId}/status`);
    if (res.status === 200 && res.data?.status === "FINALIZED") {
      console.log(
        `\nfinalized height=${res.data.blockHeight} confirmations=${res.data.confirmations}`
      );
      return;
    }
    const label = res.status === 200 ? res.data?.status : res.status;
    process.stdout.write(`.${label ?? "?"}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("timeout waiting for FINALIZED status");
}

/** PD access-list construction needs a node that stores the chunks locally. */
export async function waitForLocalOffset(
  irys: any,
  txId: string,
  timeoutMs = 60_000
): Promise<bigint | null> {
  const start = Date.now();
  process.stdout.write("waiting for local data offset");
  while (Date.now() - start < timeoutMs) {
    const res = await irys.api.get(`/tx/${txId}/local/data_start_offset`);
    if (res.status === 200 && res.data?.dataStartOffset != null) {
      const offset = BigInt(res.data.dataStartOffset);
      console.log(`\nlocal offset ${offset}`);
      return offset;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("\nno local offset on this node (PD access-list may fail here)");
  return null;
}
