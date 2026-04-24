#pragma once
// Default connection parameters used when building manually in Visual Studio.
// The TeamServer builder overwrites this file in a scratch copy before invoking
// MSBuild, so the committed values here only matter for local developer builds.
#define AGENT_C2_HOST "172.16.97.1"
#define AGENT_C2_PORT 8080
