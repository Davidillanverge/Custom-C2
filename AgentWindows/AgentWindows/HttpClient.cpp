#include "HttpClient.h"
#include <sstream>
#include <vector>

HttpClient::HttpClient(bool useHttps)
    : m_https(useHttps), hSession(nullptr), hConnect(nullptr), m_port(0)
{
    hSession = WinHttpOpen(L"C2Agent/1.0",
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS, 0);
}

HttpClient::~HttpClient() {
    if (hConnect) WinHttpCloseHandle(hConnect);
    if (hSession) WinHttpCloseHandle(hSession);
}

// Returns (and caches) a WinHTTP connection handle.
// A new connection is only opened when the host or port changes.
HINTERNET HttpClient::GetConnect(const std::wstring& host, int port) {
    if (!hConnect || m_host != host || m_port != port) {
        if (hConnect) {
            WinHttpCloseHandle(hConnect);
            hConnect = nullptr;
        }
        hConnect = WinHttpConnect(hSession, host.c_str(), (INTERNET_PORT)port, 0);
        m_host = host;
        m_port = port;
    }
    return hConnect;
}

void HttpClient::AddHeaders(HINTERNET hRequest, const std::vector<std::wstring>& headers) {
    for (const auto& header : headers) {
        WinHttpAddRequestHeaders(hRequest,
            header.c_str(), -1L,
            WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE);
    }
}

std::map<std::string, std::string> HttpClient::GetResponseHeaders(HINTERNET hRequest) {
    std::map<std::string, std::string> headers;
    DWORD size  = 0;
    DWORD index = 0;

    while (true) {
        if (!WinHttpQueryHeaders(hRequest,
                WINHTTP_QUERY_RAW_HEADERS_CRLF,
                WINHTTP_HEADER_NAME_BY_INDEX,
                NULL, &size, &index)) {
            if (GetLastError() == ERROR_INSUFFICIENT_BUFFER) {
                std::vector<wchar_t> buffer(size / sizeof(wchar_t));
                if (WinHttpQueryHeaders(hRequest,
                        WINHTTP_QUERY_RAW_HEADERS_CRLF,
                        WINHTTP_HEADER_NAME_BY_INDEX,
                        buffer.data(), &size, &index)) {
                    std::wstring headerLine(buffer.data());
                    auto pos = headerLine.find(L": ");
                    if (pos != std::wstring::npos) {
                        std::string key(headerLine.begin(), headerLine.begin() + pos);
                        std::string value(headerLine.begin() + pos + 2, headerLine.end());
                        headers[key] = value;
                    }
                }
            } else {
                break;
            }
        } else {
            break;
        }
        index++;
    }

    return headers;
}

HttpResponse HttpClient::Get(const std::wstring& host, int port,
    const std::wstring& path,
    const std::vector<std::wstring>& headers) {

    HttpResponse response;
    HINTERNET hConn = GetConnect(host, port);
    if (!hConn) return response;

    DWORD flags = m_https ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hRequest = WinHttpOpenRequest(hConn,
        L"GET", path.c_str(), NULL,
        WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!hRequest) return response;

    AddHeaders(hRequest, headers);

    if (WinHttpSendRequest(hRequest,
            WINHTTP_NO_ADDITIONAL_HEADERS, 0,
            WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
        WinHttpReceiveResponse(hRequest, NULL)) {

        response.headers = GetResponseHeaders(hRequest);

        DWORD bytesAvailable = 0;
        while (WinHttpQueryDataAvailable(hRequest, &bytesAvailable) && bytesAvailable > 0) {
            std::vector<char> buffer(bytesAvailable + 1);
            DWORD bytesRead = 0;
            if (WinHttpReadData(hRequest, buffer.data(), bytesAvailable, &bytesRead)) {
                buffer[bytesRead] = 0;
                response.body.append(buffer.data(), bytesRead);
            }
        }
    }

    WinHttpCloseHandle(hRequest);
    return response;
}

HttpResponse HttpClient::Post(const std::wstring& host, int port,
    const std::wstring& path,
    const std::string& body,
    const std::vector<std::wstring>& headers) {

    HttpResponse response;
    HINTERNET hConn = GetConnect(host, port);
    if (!hConn) return response;

    DWORD flags = m_https ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hRequest = WinHttpOpenRequest(hConn,
        L"POST", path.c_str(), NULL,
        WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!hRequest) return response;

    AddHeaders(hRequest, headers);

    if (WinHttpSendRequest(hRequest,
            WINHTTP_NO_ADDITIONAL_HEADERS, 0,
            (LPVOID)body.c_str(), (DWORD)body.size(), (DWORD)body.size(), 0) &&
        WinHttpReceiveResponse(hRequest, NULL)) {

        response.headers = GetResponseHeaders(hRequest);

        DWORD bytesAvailable = 0;
        while (WinHttpQueryDataAvailable(hRequest, &bytesAvailable) && bytesAvailable > 0) {
            std::vector<char> buffer(bytesAvailable + 1);
            DWORD bytesRead = 0;
            if (WinHttpReadData(hRequest, buffer.data(), bytesAvailable, &bytesRead)) {
                buffer[bytesRead] = 0;
                response.body.append(buffer.data(), bytesRead);
            }
        }
    }

    WinHttpCloseHandle(hRequest);
    return response;
}
