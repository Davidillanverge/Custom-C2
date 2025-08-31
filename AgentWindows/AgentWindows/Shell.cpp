#include <cstdlib>
#include <iostream>
#include <cstdio>
#include <memory>
#include <string>

#include "Commands.h"

std::string shell(std::string arguments) {
    std::string result;
    char buffer[128];

    // _popen abre un pipe con el comando
    FILE* pipe = _popen(arguments.c_str(), "r");
    if (!pipe) return "Error al ejecutar el comando";

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;  // acumula salida
    }

    _pclose(pipe);

    return result;
}
