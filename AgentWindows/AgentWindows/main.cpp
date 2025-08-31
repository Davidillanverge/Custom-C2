#include "HTTPCommunicationModule.h"
#include <iostream>
#include <string>
#include <thread>
#include "Agent.h"


int main()
{
	
	
	
	Agent agent = Agent();

	std::thread thread(&Agent::Work, &agent);
	thread.detach();

	HTTPCommunicationModule* comm = new HTTPCommunicationModule("172.16.97.1", 8080, agent);
	comm->Config();
	comm->Start();

	return 0;
}