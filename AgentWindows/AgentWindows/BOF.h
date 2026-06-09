#pragma once
#include <Windows.h>
#include <string>
#include <vector>

// Executes a COFF Beacon Object File in-memory.
// file_data  : base64-encoded .o file bytes
// file2_data : optional base64-encoded second binary blob; prepended as a raw
//              binary entry in the argument pack so the BOF can read it with
//              BeaconDataExtract before the string arguments.
// arguments  : string arguments forwarded after file2 (if any)
std::string RunBOF(std::vector<std::string> arguments, const std::string& file_data, const std::string& file2_data = "");
