#pragma once
#include "Helpers.h"
#include <vector>
#include <string>

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

Task json2Task(const std::string& json) {
    Task task;

    // Buscar el valor de "id"
    auto id_pos = json.find("\"id\"");
    if (id_pos != std::string::npos) {
        auto colon = json.find(":", id_pos);
        auto comma = json.find(",", colon);
        std::string id_str = json.substr(colon + 1, comma - colon - 1);
        task.id = std::stoi(id_str);
    }

    // Buscar el valor de "command"
    auto cmd_pos = json.find("\"command\"");
    if (cmd_pos != std::string::npos) {
        auto colon = json.find(":", cmd_pos);
        auto quote1 = json.find("\"", colon + 1);
        auto quote2 = json.find("\"", quote1 + 1);
        task.command = json.substr(quote1 + 1, quote2 - quote1 - 1);
    }

    // Buscar el valor de "arguments"
    auto args_pos = json.find("\"arguments\"");
    if (args_pos != std::string::npos) {
        auto colon = json.find(":", args_pos);
        auto quote1 = json.find("\"", colon + 1);
        auto quote2 = json.find("\"", quote1 + 1);
        task.arguments = json.substr(quote1 + 1, quote2 - quote1 - 1);
    }

    // Buscar el valor de "file"
    auto file_pos = json.find("\"file\"");
    if (file_pos != std::string::npos) {
        auto colon = json.find(":", file_pos);
        auto quote1 = json.find("\"", colon + 1);
        auto quote2 = json.find("\"", quote1 + 1);
        task.file = json.substr(quote1 + 1, quote2 - quote1 - 1);
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
