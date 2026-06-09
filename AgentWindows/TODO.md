# AgentWindows — Pending Improvements

Items marked ✅ have been implemented. Items marked ⬜ are still pending.

## Architecture

1. ✅ **WinHTTP beaconing client**
   Implemented with `HttpClient` (WinHTTP-based, persistent connection, HTTPS flag).

2. ⬜ **Encrypted C2 traffic**
   Encrypt the beacon payload and task responses (AES-256-CBC or ChaCha20-Poly1305) with a pre-shared key embedded at build time. The current base64 encoding is not encryption.

3. ✅ **Jitter implementation fix**
   Beacon sleep is now `interval ± jitter` via `std::uniform_int_distribution` in `nextSleepMs()`.

4. ⬜ **Wider agent ID range**
   The current `std::uniform_int_distribution<int>(1000, 9999)` only has 9 000 possible IDs, making collisions likely at scale. Use a cryptographic random 32-bit integer or UUID-style ID.

5. ⬜ **YARA / static-analysis obfuscation of magic markers**
   The 8-byte magic prefixes in `AgentConfig.cpp` (`\xDE\xAD\xBE\xEF\xC2\xC2\xC2\xC2…`) are trivially YARA-matchable.  
   Fix: XOR the magic constants with a compile-time key in both `AgentConfig.cpp` and `BuilderService._patch_dll()` so they do not appear in the binary as literal byte sequences.  
   **Note:** This requires a coordinated change to both the agent and the TeamServer patcher — both must use the same XOR key.

## Reliability

6. ✅ **Conditional logging**
   Removed all `std::cout` / `printf()` debug output from `Agent.cpp`, `HTTPCommunicationModule.cpp`, and `InlineAssembly.cpp`.

7. ⬜ **Beacon error back-off**
   If the C2 server is unreachable, the agent should back off exponentially rather than retrying at the same interval. Cap the back-off at a configurable maximum.  
   The current implementation restores results to the queue on connection failure (no result loss), but the retry interval is fixed.

8. ⬜ **Robust JSON parsing**
   The hand-rolled JSON parser in `Helpers.cpp` handles quoted strings and nested braces correctly now, but still lacks proper escape-sequence decoding (e.g. `\uXXXX`).  
   Consider replacing with a header-only library (e.g. nlohmann/json) for full correctness.

9. ⬜ **Compress large results**
   For `download` and `inline-assembly` output, base64 of a large binary is expensive. Compress with zlib/deflate before base64-encoding to reduce beacon payload size.

## New Commands

10. ⬜ **Screenshot command**
    Implement `screenshot` using `BitBlt`/`GetDIBits` to capture the desktop and return it as a base64-encoded PNG or BMP via the `FILE:` protocol already used by `download`.

11. ⬜ **Process injection**
    Add a `inject <pid> <shellcode_b64>` command using `VirtualAllocEx` + `WriteProcessMemory` + `CreateRemoteThread` for lateral movement.

12. ⬜ **Named pipe / SMB channel**
    Add an `SMBListener` transport so agents can communicate peer-to-peer via named pipes, enabling pivoting through internal hosts that cannot reach the C2 directly.

## Build

13. ⬜ **Cross-compilation CI**
    Add a GitHub Actions workflow (Windows runner) that builds `Release/x64`, `Release/x86`, and `Release/ARM64`, copies the DLLs to `AgentWindows/dist/`, and triggers the TeamServer builder smoke test.
