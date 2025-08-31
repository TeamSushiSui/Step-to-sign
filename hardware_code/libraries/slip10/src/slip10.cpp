#include "slip10.h"
#include <SHA512.h>
#include <HMAC.h>

void SLIP10::hmacSha512(const uint8_t *key, size_t keyLen, const uint8_t *data, size_t dataLen, uint8_t *output) {
  HMAC<SHA512> hmac;
  hmac.reset(key, keyLen);
  hmac.update(data, dataLen);
  hmac.finalize(output, 64);
}

void SLIP10::masterKeyFromSeed(const uint8_t *seed, size_t seedLen, Slip10Key &outKey) {
  const char *curve = ED25519_CURVE;
  hmacSha512((const uint8_t *)curve, strlen(curve), seed, seedLen, outKey.key);
}

void SLIP10::derive(const Slip10Key &parent, uint32_t index, Slip10Key &outKey) {
  uint8_t data[1 + 32 + 4];
  data[0] = 0x00;                         // padding
  memcpy(data + 1, parent.key, 32);       // parent private key
  data[33] = (index >> 24) & 0xFF;        // hardened index
  data[34] = (index >> 16) & 0xFF;
  data[35] = (index >> 8) & 0xFF;
  data[36] = index & 0xFF;

  hmacSha512(parent.key + 32, 32, data, sizeof(data), outKey.key);
}

