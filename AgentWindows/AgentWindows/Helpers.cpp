#pragma once
#include "Helpers.h"
#include <vector>
#include <string>
#include <sddl.h>

std::wstring s2ws(const std::string& str) {
    return std::wstring(str.begin(), str.end());
}

std::string arrayTaskResult2json(const std::vector<TaskResult>& results) {
    std::ostringstream oss;
    oss << "[";
    for (size_t i = 0; i < results.size(); ++i) {
        oss << results[i].to_json();
        if (i != results.size() - 1) {
            oss << ",";
        }
    }
    oss << "]";
    return oss.str();
}

// Helper: quita espacios y comillas
std::string trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\n\r\"");
    size_t last = str.find_last_not_of(" \t\n\r\"");
    if (first == std::string::npos || last == std::string::npos)
        return "";
    return str.substr(first, (last - first + 1));
}

// Parsear JSON muy básico
Task json2Task(const std::string& json) {
    Task task{};
    size_t pos = 0;

    // ID
    pos = json.find("\"id\"");
    if (pos != std::string::npos) {
        size_t colon = json.find(":", pos);
        size_t comma = json.find(",", colon);
        task.id = std::stoi(trim(json.substr(colon + 1, comma - colon - 1)));
    }

    // command
    pos = json.find("\"command\"");
    if (pos != std::string::npos) {
        size_t colon = json.find(":", pos);
        size_t comma = json.find(",", colon);
        task.command = trim(json.substr(colon + 1, comma - colon - 1));
    }

    // arguments
    pos = json.find("\"arguments\"");
    if (pos != std::string::npos) {
        size_t openBracket = json.find("[", pos);
        size_t closeBracket = json.find("]", openBracket);
        std::string argsStr = json.substr(openBracket + 1, closeBracket - openBracket - 1);

        std::stringstream ss(argsStr);
        std::string arg;
        while (std::getline(ss, arg, ',')) {
            task.arguments.push_back(trim(arg));
        }
    }

    // file
    pos = json.find("\"file\"");
    if (pos != std::string::npos) {
        size_t colon = json.find(":", pos);
        size_t end = json.find("}", colon);
        task.file = trim(json.substr(colon + 1, end - colon - 1));
    }

    return task;
}


std::vector<Task> json2arrayTasks(const std::string& json) {
    std::vector<Task> tasks;
    size_t pos = 0;
    while (true) {
        size_t start_pos = json.find("{", pos);
        if (start_pos == std::string::npos) break;
        size_t end_pos = json.find("}", start_pos);
        if (end_pos == std::string::npos) break;
        std::string task_json = json.substr(start_pos, end_pos - start_pos + 1);
        Task task = json2Task(task_json);
        tasks.push_back(task);
        pos = end_pos + 1;
    }
    return tasks;
}

static const std::string base64_chars =
"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
"abcdefghijklmnopqrstuvwxyz"
"0123456789+/";

std::string base64_encode(const std::string& input) {
    std::string encoded;
    int val = 0, valb = -6;
    for (unsigned char c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            encoded.push_back(base64_chars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) encoded.push_back(base64_chars[((val << 8) >> (valb + 8)) & 0x3F]);
    while (encoded.size() % 4) encoded.push_back('=');
    return encoded;
}
std::string json_escape(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
        case '\"': out += "\\\""; break;
        case '\\': out += "\\\\"; break;
        case '\r': break; // opcional: ignorar \r
        case '\n': out += "\\n"; break;
        default: out += c;
        }
    }
    return out;
}

std::string readPipe(HANDLE hRead) {
    std::string result;
    char buffer[4096];
    DWORD bytesRead;
    while (true) {
        BOOL success = ReadFile(hRead, buffer, sizeof(buffer) - 1, &bytesRead, NULL);
        if (!success || bytesRead == 0) break;

        buffer[bytesRead] = '\0';
        result += buffer;
    }

    return result;
}

std::string GetArch() {
    SYSTEM_INFO si;
    GetNativeSystemInfo(&si);

    switch (si.wProcessorArchitecture) {
    case PROCESSOR_ARCHITECTURE_AMD64:
        return "x64 (AMD or Intel)";
    case PROCESSOR_ARCHITECTURE_INTEL:
        return "x86";
    case PROCESSOR_ARCHITECTURE_ARM:
        return "ARM";
    case PROCESSOR_ARCHITECTURE_ARM64:
        return "ARM64";
    case PROCESSOR_ARCHITECTURE_IA64:
        return "Intel Itanium-based";
    case PROCESSOR_ARCHITECTURE_UNKNOWN:
    default:
        return "Unknown";
    }
}

std::string GetHostname() {
    char buffer[MAX_COMPUTERNAME_LENGTH + 1];
    DWORD size = sizeof(buffer);
    if (GetComputerNameA(buffer, &size)) {
        return std::string(buffer);
    }

    return "unknown";
}

std::string GetProcessname() {
    char buffer[MAX_PATH];
    DWORD size = GetModuleFileNameA(NULL, buffer, MAX_PATH);
    if (size == 0) {
        return {};
    }

    std::string fullPath(buffer);

    size_t pos = fullPath.find_last_of("\\/");
    if (pos != std::string::npos) {
        return fullPath.substr(pos + 1);
    }
    return fullPath;
}


std::string GetProcessIntegrityLevel() {
    HANDLE hToken = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
        return std::string("unknown");
    }

    DWORD length = 0;
    GetTokenInformation(hToken, TokenIntegrityLevel, nullptr, 0, &length);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER) {
        CloseHandle(hToken);
        return std::string("unknown");
    }

    PTOKEN_MANDATORY_LABEL pTIL = (PTOKEN_MANDATORY_LABEL)LocalAlloc(0, length);
    if (!pTIL) {
        CloseHandle(hToken);
        return std::string("unknown");
    }

    if (!GetTokenInformation(hToken, TokenIntegrityLevel, pTIL, length, &length)) {
        LocalFree(pTIL);
        CloseHandle(hToken);
        return std::string("unknown");
    }

    DWORD rid = *GetSidSubAuthority(pTIL->Label.Sid,
        (DWORD)(*GetSidSubAuthorityCount(pTIL->Label.Sid) - 1));

    std::string level;
    switch (rid) {
    case SECURITY_MANDATORY_UNTRUSTED_RID: level = "Untrusted"; break;
    case SECURITY_MANDATORY_LOW_RID:       level = "Low"; break;
    case SECURITY_MANDATORY_MEDIUM_RID:    level = "Medium"; break;
    case SECURITY_MANDATORY_HIGH_RID:      level = "High"; break;
    case SECURITY_MANDATORY_SYSTEM_RID:    level = "System"; break;
    case SECURITY_MANDATORY_PROTECTED_PROCESS_RID: level = "Protected Process"; break;
    default: level = "Unknown (" + std::to_string(rid) + ")"; break;
    }

    LocalFree(pTIL);
    CloseHandle(hToken);

    return level;
}
