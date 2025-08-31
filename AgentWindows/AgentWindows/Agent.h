#pragma once
#include <string>
#include <queue>
#include "Helpers.h"

struct AgentMetadata
{
	int id;
	std::string hostname;
	std::string username;
	std::string processname;
	int pid;
	std::string integrity;
	std::string arch;

	std::string to_json() {
		std::ostringstream oss;
		oss << "{"
			<< "\"id\":" << id << ","
			<< "\"hostname\":\"" << hostname << "\","
			<< "\"username\":\"" << username << "\","
			<< "\"processname\":\"" << processname << "\","
			<< "\"pid\":" << pid << ","
			<< "\"integrity\":\"" << integrity << "\","
			<< "\"arch\":\"" << arch << "\""
			<< "}";
		return oss.str();
	}
};

class Agent
{
private:
	AgentMetadata Metadata;
	std::queue<Task> Tasks;
	std::queue<TaskResult> Results;

public:
	Agent(const AgentMetadata& metadata);

	AgentMetadata getMetadata();

	void addTask(const Task& task);

	Task& getNextTask();

	void addResult(const TaskResult& result);

	TaskResult& getNextResult();

	std::vector<TaskResult> getTaskResults();

	void executeTask(Task& task);

	void Work();

};