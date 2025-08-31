#include <Windows.h>
#include <Lmcons.h>

#include "Commands.h"

std::string whoami(std::string arguments) {
    char username[UNLEN + 1];
    DWORD size = UNLEN + 1;

    if (GetUserNameA(username, &size)) {
        return std::string(username);
    }
    else {
        return "unknown";
    }
}