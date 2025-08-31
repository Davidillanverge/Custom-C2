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
    size_t id_pos = json.find("\"id\":");
    if (id_pos != std::string::npos) {
        size_t comma_pos = json.find(",", id_pos);
        task.id = std::stoi(json.substr(id_pos + 5, comma_pos - (id_pos + 5)));
    }
    size_t command_pos = json.find("\"command\":\"");
    if (command_pos != std::string::npos) {
        size_t end_quote_pos = json.find("\"", command_pos + 11);
        task.command = json.substr(command_pos + 11, end_quote_pos - (command_pos + 11));
    }
    size_t arguments_pos = json.find("\"arguments\":\"");
    if (arguments_pos != std::string::npos) {
        size_t end_quote_pos = json.find("\"", arguments_pos + 13);
        task.arguments = json.substr(arguments_pos + 13, end_quote_pos - (arguments_pos + 13));
    }
    size_t file_pos = json.find("\"file\":\"");
    if (file_pos != std::string::npos) {
        size_t end_quote_pos = json.find("\"", file_pos + 8);
        task.file = json.substr(file_pos + 8, end_quote_pos - (file_pos + 8));
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
        tasks.push_back(json2Task(task_json));
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
