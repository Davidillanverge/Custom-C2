#include "MakeToken.h"
#include <sstream>

static HANDLE g_hImpersonationToken = NULL;

void ClearImpersonationToken() {
    if (g_hImpersonationToken != NULL) {
        CloseHandle(g_hImpersonationToken);
        g_hImpersonationToken = NULL;
    }
}

std::string MakeToken(std::vector<std::string> arguments) {
    if (arguments.size() < 3)
        return "Error: usage: make_token <username> <domain> <password>";

    const std::string& username = arguments[0];
    const std::string& domain   = arguments[1];
    const std::string& password = arguments[2];

    if (g_hImpersonationToken != NULL) {
        RevertToSelf();
        CloseHandle(g_hImpersonationToken);
        g_hImpersonationToken = NULL;
    }

    BOOL ok = LogonUserA(
        username.c_str(),
        domain.empty() ? "." : domain.c_str(),
        password.c_str(),
        LOGON32_LOGON_NEW_CREDENTIALS,
        LOGON32_PROVIDER_DEFAULT,
        &g_hImpersonationToken
    );

    if (!ok)
        return "Error: LogonUser failed (code " + std::to_string(GetLastError()) + ")";

    ok = ImpersonateLoggedOnUser(g_hImpersonationToken);
    if (!ok) {
        CloseHandle(g_hImpersonationToken);
        g_hImpersonationToken = NULL;
        return "Error: ImpersonateLoggedOnUser failed (code " + std::to_string(GetLastError()) + ")";
    }

    return "Token created — impersonating " + domain + "\\" + username;
}
