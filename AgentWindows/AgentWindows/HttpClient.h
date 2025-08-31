#ifndef HTTPCLIENT_H
#define HTTPCLIENT_H

#include <string>
#include <windows.h>
#include <winhttp.h>
#include <vector>
#include <map>

#pragma comment(lib, "winhttp.lib")

struct HttpResponse {
    std::string body;
    std::map<std::string, std::string> headers;
};

class HttpClient {
public:
    HttpClient();
    ~HttpClient();

    HttpResponse Get(const std::wstring& host,
        const int port,
        const std::wstring& path,
        const std::vector<std::wstring>& headers = {});

    HttpResponse Post(const std::wstring& host,
		const int port,
        const std::wstring& path,
        const std::string& body,
        const std::vector<std::wstring>& headers = {});

private:
    HINTERNET hSession;

    void AddHeaders(HINTERNET hRequest, const std::vector<std::wstring>& headers);
    std::map<std::string, std::string> GetResponseHeaders(HINTERNET hRequest);
};

#endif // HTTPCLIENT_H
