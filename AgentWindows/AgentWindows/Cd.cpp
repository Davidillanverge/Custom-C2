#include "Commands.h"

std::string Cd(std::vector<std::string> arguments) {
    if (SetCurrentDirectoryA(arguments[0].c_str())) {
        return std::string("Current directory has changed.");
    }
    return std::string("Error");
}