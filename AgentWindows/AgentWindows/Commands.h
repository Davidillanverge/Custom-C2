#pragma once
#include <Windows.h>
#include <string>
#include <vector>
#include "Helpers.h"

std::string whoami(std::vector<std::string> arguments);
std::string shell(std::vector<std::string> arguments);
std::string run(std::vector<std::string> arguments);
std::string pwd(std::vector<std::string> arguments);
std::string Cd(std::vector<std::string> arguments);
std::string Ls(std::vector<std::string> arguments);