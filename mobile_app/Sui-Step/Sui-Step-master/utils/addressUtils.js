/* eslint-disable no-undef */
import { blake2b } from "blakejs";

function hexToUint8Array(hex) {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(arr) {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function deriveSuiAddressFromPubkey(publicKeyHex) {
  const publicKey = hexToUint8Array(publicKeyHex);

  // Prepends signature scheme flag for Ed25519 (0x00)
  const flaggedPubkey = new Uint8Array(1 + publicKey.length);
  flaggedPubkey[0] = 0x00; // Ed25519 flag
  flaggedPubkey.set(publicKey, 1);

  // Hashes with BLAKE2b-256
  const hash = blake2b(flaggedPubkey, undefined, 32);

  // Converts hash to hex string
  const suiAddress = uint8ArrayToHex(hash);

  return `0x${suiAddress}`;
}

// Validates if a string is a valid Sui address format
function isValidSuiAddress(address) {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Sui addresses should start with 0x and be 66 characters long (including 0x)
  // e.g., 0x...4567
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

// Truncates a Sui address for display
export function truncateAddress(address, startChars = 6, endChars = 4) {
  if (!address || address.length < startChars + endChars + 2) {
    return address;
  }
  return `${address.slice(0, startChars + 2)}...${address.slice(-endChars)}`;
}
