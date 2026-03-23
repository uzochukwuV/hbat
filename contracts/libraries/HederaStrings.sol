// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal Strings replacement for Hedera (no mcopy / Bytes.sol dependency).
library HederaStrings {
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (value != 0) {
            digits--;
            buf[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buf);
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buf = new bytes(2 * length + 2);
        buf[0] = "0"; buf[1] = "x";
        bytes16 symbols = "0123456789abcdef";
        for (uint256 i = 2 * length + 1; i > 1; i--) {
            buf[i] = symbols[value & 0xf];
            value >>= 4;
        }
        return string(buf);
    }
}
