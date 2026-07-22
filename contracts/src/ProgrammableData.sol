// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Vendored from Irys-xyz/irys fixtures/contracts/src/ProgrammableData.sol
import "./Precompiles.sol";

contract ProgrammableData {
    function readBytes() public view returns (bool success, bytes memory data) {
        return readByteRange(0);
    }

    function readBytes(
        uint32 relative_offset,
        uint32 length
    ) public view returns (bool success, bytes memory result) {
        return readByteRange(0, relative_offset, length);
    }

    function readByteRange(
        uint8 byte_range_index
    ) public view returns (bool success, bytes memory data) {
        return
            address(PD_READ_PRECOMPILE_ADDRESS).staticcall(
                bytes.concat(
                    bytes1(READ_FULL_BYTE_RANGE),
                    bytes1(byte_range_index)
                )
            );
    }

    function readByteRange(
        uint8 byte_range_index,
        uint32 start_offset,
        uint32 length
    ) public view returns (bool success, bytes memory data) {
        return
            address(PD_READ_PRECOMPILE_ADDRESS).staticcall(
                bytes.concat(
                    bytes1(READ_PARTIAL_BYTE_RANGE),
                    bytes1(byte_range_index),
                    bytes4(start_offset),
                    bytes4(length)
                )
            );
    }
}
