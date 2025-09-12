#include "Commands.h"

std::string pwd(std::vector<std::string> arguments) {
    char buffer[MAX_PATH];
    DWORD ret = GetCurrentDirectoryA(MAX_PATH, buffer);
    if (ret == 0 || ret > MAX_PATH) {
        // Error al obtener el directorio actual
        return {};
    }
    return std::string(buffer);
}
