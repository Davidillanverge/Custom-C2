#pragma once
#include <Windows.h>
#include <string>
#include <vector>

// Executes a COFF Beacon Object File in-memory.
// file_data  : base64-encoded .o file bytes
// arguments  : arguments forwarded to the BOF entry point ("go")
//              packed as [4-byte total size][4-byte len][bytes]...
std::string RunBOF(std::vector<std::string> arguments, const std::string& file_data);
