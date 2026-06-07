#include "Rev2Self.h"
#include "MakeToken.h"

std::string Rev2Self(std::vector<std::string> arguments) {
    if (!RevertToSelf())
        return "Error: RevertToSelf failed (code " + std::to_string(GetLastError()) + ")";

    ClearImpersonationToken();

    return "Reverted to original security context";
}
