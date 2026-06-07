#pragma once
#include <Windows.h>
#include <string>
#include <vector>

// Executes a .NET assembly in-memory via CLR hosting.
// file_data : base64-encoded assembly bytes (EXE or DLL)
// arguments : argv to pass to the assembly entry point
std::string InlineAssembly(std::vector<std::string> arguments, const std::string& file_data);
