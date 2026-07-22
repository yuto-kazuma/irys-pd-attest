export const VERIFIABLE_AI_ABI = [
  "function attest() returns (uint256 id, bytes32 dataHash)",
  "function verify(uint256 id, bytes32 expected) view returns (bool)",
  "function attestationCount() view returns (uint256)",
  "function attestations(uint256) view returns (bytes32 dataHash, uint256 length, address attester, uint256 timestamp)",
  "event Attested(uint256 indexed id, bytes32 indexed dataHash, address indexed attester, uint256 length)",
];
