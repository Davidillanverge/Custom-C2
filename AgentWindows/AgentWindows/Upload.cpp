#include "Upload.h"
#include "Helpers.h"

std::string Upload(std::vector<std::string> arguments, const std::string& file_data) {
    if (arguments.empty() || arguments[0].empty())
        return "Error: destination path required";
    if (file_data.empty())
        return "Error: no file data";

    std::string path = arguments[0];
    std::string data = base64_decode(file_data);

    HANDLE hFile = CreateFileA(
        path.c_str(),
        GENERIC_WRITE,
        0,
        NULL,
        CREATE_ALWAYS,
        FILE_ATTRIBUTE_NORMAL,
        NULL
    );

    if (hFile == INVALID_HANDLE_VALUE)
        return "Error: cannot create file (code " + std::to_string(GetLastError()) + ")";

    DWORD bytesWritten = 0;
    BOOL ok = WriteFile(hFile, data.data(), static_cast<DWORD>(data.size()), &bytesWritten, NULL);
    CloseHandle(hFile);

    if (!ok)
        return "Error: cannot write file (code " + std::to_string(GetLastError()) + ")";

    return "Uploaded " + std::to_string(bytesWritten) + " bytes to " + path;
}
