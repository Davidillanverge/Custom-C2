#pragma once
#include <sstream>
#include <vector>

struct TaskResult {
    int task_id;
    std::string result;

    std::string to_json() const {
        std::ostringstream oss;
        oss << "{"
            << "\"task_id\":" << task_id << ","
            << "\"result\":\"" << result << "\""
            << "}";
        return oss.str();
    }
};

struct Task {
    int id;
    std::string command;
    std::vector<std::string> arguments;
    std::string file;

    std::string to_json()const {
        std::string json = "{";

    json += "\"id\": " + std::to_string(id) + ", ";
    json += "\"command\": \"" + command + "\", ";

    // Serializar vector de argumentos como array JSON
    json += "\"arguments\": [";
    for (size_t i = 0; i < arguments.size(); i++) {
        json += "\"" + arguments[i] + "\"";
        if (i < arguments.size() - 1) json += ", ";
    }
    json += "], ";

    json += "\"file\": \"" + file + "\"";

    json += "}";

    return json;
    }
};

std::wstring s2ws(const std::string& str);
std::string arrayTaskResult2json(const std::vector<TaskResult>& results);
Task json2Task(const std::string& json);
std::vector<Task> json2arrayTasks(const std::string& json);
std::string base64_encode(const std::string& input);