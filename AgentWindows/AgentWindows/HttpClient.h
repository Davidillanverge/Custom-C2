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
    // useHttps: if true, all requests use WINHTTP_FLAG_SECURE (TLS).
    // Automatically set to true when port == 443.
    explicit HttpClient(bool useHttps = false);
    ~HttpClient();

    HttpResponse Get(const std::wstring& host,
                     int port,
                     const std::wstring& path,
                     const std::vector<std::wstring>& headers = {});

    HttpResponse Post(const std::wstring& host,
                      int port,
                      const std::wstring& path,
                      const std::string& body,
                      const std::vector<std::wstring>& headers = {});

private:
    bool          m_https;
    HINTERNET     hSession;
    HINTERNET     hConnect;     // persistent connection — re-created only if host/port changes
    std::wstring  m_host;
    int           m_port;

    HINTERNET GetConnect(const std::wstring& host, int port);
    void AddHeaders(HINTERNET hRequest, const std::vector<std::wstring>& headers);
    std::map<std::string, std::string> GetResponseHeaders(HINTERNET hRequest);
};

#endif // HTTPCLIENT_H
