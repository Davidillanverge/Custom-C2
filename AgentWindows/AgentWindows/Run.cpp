#include <cstdlib>
#include <iostream>
#include <cstdio>
#include <memory>
#include <string>
#include <cstring>
#include <sstream>

#include "Commands.h"

char* create_commandline(const std::vector<std::string>& arguments) {
    // Construir la línea de comando separada por espacios
    std::ostringstream oss;
    for (size_t i = 0; i < arguments.size(); ++i) {
        if (i > 0) oss << " ";
        oss << arguments[i];
    }
    std::string cmdStr = oss.str();

    // Crear buffer mutable con terminador nulo
    char* cmdline = new char[cmdStr.size() + 1];
    strcpy_s(cmdline, cmdStr.size() + 1, cmdStr.c_str()); // copia segura
    return cmdline; // el llamador debe hacer delete[]
}

std::string run(std::vector<std::string> arguments) {
    std::string result;

    //Redirigir output
    SECURITY_ATTRIBUTES sa;
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.bInheritHandle = TRUE;  // permite herencia de handles
    sa.lpSecurityDescriptor = NULL;

    HANDLE hRead, hWrite;

    // Crear pipe anónimo
    if (!CreatePipe(&hRead, &hWrite, &sa, 0)) {
        std::cerr << "Error al crear pipe\n";
        return "Error creating pipe";
    }

    // Asegurarnos de que el handle de lectura no se herede
    SetHandleInformation(hRead, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOA si = { 0 };
    PROCESS_INFORMATION pi = { 0 };

    si.cb = sizeof(si);
    si.hStdOutput = hWrite;  // redirige stdout
    si.hStdError = hWrite;  // redirige stderr también
    si.dwFlags |= STARTF_USESTDHANDLES;

    char* cmd = create_commandline(arguments);
    if (!CreateProcessA(NULL, cmd, NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        return "Error al ejecutar el comando";
    }

    CloseHandle(hWrite);

    result = readPipe(hRead);

    WaitForSingleObject(pi.hProcess, INFINITE);

    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(hRead);

    return result;
}
