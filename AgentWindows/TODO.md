# AgentWindows — Pending Improvements

## Architecture

1. **WinHTTP beaconing client**
   Replace the raw socket implementation with WinHTTP (or WinINet) for proper HTTP/HTTPS support, proxy awareness, and TLS certificate handling without manual implementation.

2. **Encrypted C2 traffic**
   Encrypt the beacon payload and task responses (AES-256-CBC or ChaCha20-Poly1305) with a pre-shared key embedded at build time. The current base64 encoding is not encryption.

3. **Jitter implementation fix**
   The beacon sleep should be `interval ± random(0, jitter)`, not `interval + jitter`. Replace the deterministic add with a `std::uniform_int_distribution` draw in the beacon loop.

4. **Wider agent ID range**
   The current `std::uniform_int_distribution<int>(1000, 9999)` only has 9000 possible IDs, making collisions likely at scale. Use a cryptographic random 32-bit integer or UUID-style ID.

## Reliability

5. **Conditional logging**
   Replace `std::cout` debug output in `Agent::executeTask` and `Agent::Work` with a compile-time log level (`#ifdef DEBUG`). Debug prints should not appear in release builds.

6. **Beacon error handling**
   If the C2 server is unreachable, the agent should back off exponentially rather than retrying at the same interval. Cap the back-off at a configurable maximum.

7. **Robust JSON parsing**
   The hand-rolled JSON parser in `Helpers.cpp` is fragile. Replace with a header-only library (e.g., nlohmann/json) to handle escaped characters, nested objects, and edge cases correctly.

8. **Compress large results**
   For `download` and `inline-assembly` output, base64 of a large binary is expensive. Compress with zlib/deflate before base64-encoding to reduce beacon payload size.

## New Commands

9. **Screenshot command**
   Implement `screenshot` using `BitBlt`/`GetDIBits` to capture the desktop and return it as a base64-encoded PNG or BMP via the `FILE:` protocol already used by `download`.

10. **Process injection**
    Add a `inject <pid> <shellcode_b64>` command using `VirtualAllocEx` + `WriteProcessMemory` + `CreateRemoteThread` for lateral movement.

11. **Named pipe / SMB channel**
    Add an `SMBListener` transport so agents can communicate peer-to-peer via named pipes, enabling pivoting through internal hosts that cannot reach the C2 directly.

## Build

12. **Cross-compilation CI**
    Add a GitHub Actions workflow (Windows runner) that builds `Release/x64`, `Release/x86`, and `Release/ARM64`, copies the DLLs to `AgentWindows/dist/`, and triggers the TeamServer builder smoke test.
