#ifndef SLIP10_H
#define SLIP10_H

#include <Arduino.h>

class Slip10 {
public:
    static void deriveMasterKey(const uint8_t *seed, size_t seedLen, uint8_t *key, uint8_t *chainCode);
    static void deriveChildKey(const uint8_t *parentKey, const uint8_t *parentChainCode,
                               uint32_t index, uint8_t *childKey, uint8_t *childChainCode);
};

#endif

