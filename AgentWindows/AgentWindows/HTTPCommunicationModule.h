#include <string>
#include "HttpClient.h"
#include "Agent.h"


class HTTPCommunicationModule {
	private:
		Agent& agent;
		std::string Address;
		int Port;
		HttpClient httpClient;
		std::vector<std::wstring> headers;
		bool running;

	public:
		HTTPCommunicationModule(const std::string& address, int port, Agent& agent);

		virtual void Config();

		virtual void Start();

		virtual void Stop();

		virtual void Checkin();
};
