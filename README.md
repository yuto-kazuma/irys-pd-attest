# irys-pd-attest

Upload data as native Irys L1 chunks, then have an IrysVM contract read it via the Programmable Data precompile (`0x500`), hash it on-chain, and verify.

## Layout

```
contracts/src/   VerifiableAI.sol + vendored PD helpers
app/src/         upload / attest / verify / deploy scripts
```

## Setup

```bash
cp .env.example .env
cd app && npm install
```

Needs Node 18+ and a funded IrysVM testnet key ([faucet](https://irys.xyz/faucet)).

## Run

```bash
cd app
npm run deploy    # writes CONTRACT_ADDRESS into ../.env
npm run upload    # V1 data tx → wait until FINALIZED
npm run attest    # PD access-list + on-chain keccak256
npm run verify 0
```

## What we hit on public testnet (Jul 2026)

- `@irys/js@0.0.2` still builds **V0** data headers. Testnet rejects them (`unknown version: 0`). This repo posts **V1** headers (`prefixSize` / `prefixHash` / `metadataFormat`).
- Node URL must be `https://testnet-rpc.irys.xyz/v1` (**no** trailing slash). A trailing slash makes the SDK request `/v1/v1/...`.
- Price API returns `{permFee,termFee,...}` (object). The SDK's `getPrice()` still expects a bare integer — upload sets fees manually.
- Upload **does** reach `FINALIZED` on chain. Example: `8dNv1Lh5X2NgZyAa9yWhNWGfvHWWVEMWEqmC5WkKyECH`.
- `/tx/{id}/local/data_start_offset` stays **404** on the public RPC after finality, so PD access-list construction fails there. That endpoint only works on a node that stores the chunks locally (see Irys `get_tx_local_start_offset`).

## Notes

- PD precompile ABI may change ([#1232](https://github.com/Irys-xyz/irys/issues/1232)).
- Reference (local-node) flow: [`irys-js` programmableData test](https://github.com/Irys-xyz/irys-js/blob/master/tests/programmableData.ts).
