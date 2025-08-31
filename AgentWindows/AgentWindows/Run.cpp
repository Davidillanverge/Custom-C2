#include <cstdlib>
#include <iostream>
#include <cstdio>
#include <memory>
#include <string>
#include <Windows.h>

#include "Commands.h"

std::string run(std::vector<std::string> arguments) {
    std::string result;

    std::string args;
    for (int i = 0; i < arguments.size(); i++) {
        args += arguments[i];
        if (i < arguments.size() - 1) args += " ";
    }

    STARTUPINFOA si = {};
    PROCESS_INFORMATION pi = {};

    // Crear un buffer mutable con terminador nulo
    std::vector<char> buffer(args.begin(), args.end());
    buffer.push_back('\0');
    char* cmd = buffer.data();

    if (!CreateProcessA(NULL, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        return "Error al ejecutar el comando";
    }

    WaitForSingleObject(pi.hProcess, INFINITE);

    return result;
}
