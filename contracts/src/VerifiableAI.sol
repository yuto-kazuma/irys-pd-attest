// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProgrammableData.sol";

/// @notice Attests keccak256 of bytes read from Irys storage via PD (not calldata).
contract VerifiableAI is ProgrammableData {
    struct Attestation {
        bytes32 dataHash;
        uint256 length;
        address attester;
        uint256 timestamp;
    }

    Attestation[] public attestations;

    event Attested(
        uint256 indexed id,
        bytes32 indexed dataHash,
        address indexed attester,
        uint256 length
    );

    /// @dev Caller must include a PD access list on the tx.
    function attest() external returns (uint256 id, bytes32 dataHash) {
        (bool ok, bytes memory data) = readBytes();
        require(ok, "PD read failed");
        require(data.length > 0, "empty PD read");

        dataHash = keccak256(data);
        id = attestations.length;
        attestations.push(
            Attestation({
                dataHash: dataHash,
                length: data.length,
                attester: msg.sender,
                timestamp: block.timestamp
            })
        );

        emit Attested(id, dataHash, msg.sender, data.length);
    }

    function verify(uint256 id, bytes32 expected) external view returns (bool) {
        require(id < attestations.length, "no such attestation");
        return attestations[id].dataHash == expected;
    }

    function attestationCount() external view returns (uint256) {
        return attestations.length;
    }
}
