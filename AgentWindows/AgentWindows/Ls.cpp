#include "Commands.h"

std::string Ls(std::vector<std::string> arguments) {
    std::string result;
    WIN32_FIND_DATAA findData;
    std::string path;
    if (arguments.empty() || arguments[0].empty()) {
        char buffer[MAX_PATH];
        DWORD ret = GetCurrentDirectoryA(MAX_PATH, buffer);
        if (ret == 0 || ret > MAX_PATH) {
            return {};
        }
        path = buffer;
    } else {
        path = arguments[0];
    }
    HANDLE hFind = FindFirstFileA((path + "\\*").c_str(), &findData);

    if (hFind == INVALID_HANDLE_VALUE) {
        return result; // devuelve string vac�o si no hay archivos o error
    }

    do {
        std::string name = findData.cFileName;
        if (name != "." && name != "..") {
            result += name + "\n";
        }
    } while (FindNextFileA(hFind, &findData) != 0);

    FindClose(hFind);
    return result;
}
