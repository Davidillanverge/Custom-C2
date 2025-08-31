#include "Agent.h"
#include <iostream>
#include <thread>
#include <chrono>

Agent::Agent(const AgentMetadata& metadata){
	Metadata = metadata;
}

AgentMetadata Agent::getMetadata(){
	return Metadata;
}

void Agent::addTask(const Task& task){
	Tasks.push(task);
}

Task& Agent::getNextTask() {
	Task& task = Tasks.front();
	Tasks.pop();

	return task;
}

void Agent::addResult(const TaskResult& result) { Results.push(result); }

TaskResult& Agent::getNextResult() {
	TaskResult& result = Results.front();
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
	std::string command_output = "Test output";
	TaskResult result = { task.id, command_output };

	Agent::addResult(result);
}

void Agent::Work() {
	while (true) {
		std::cout << "Working Tasks ...." << std::endl;
		if (!Tasks.empty()) {
			Task& task = Agent::getNextTask();
			Agent::executeTask(task);
			
		}
		std::this_thread::sleep_for(std::chrono::seconds(1));
	}
}

