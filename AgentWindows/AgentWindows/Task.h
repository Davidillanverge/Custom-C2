#pragma once
#include <string>
class Task
{
private:
	int Id;
	std::string Command;
	std::string Argumets;
	std::string File;

public:
	Task(int id, std::string command, std::string arguments, std::string file) {
		Id = id;
		Command = command;
		Argumets = arguments;
		File = file;
	}

	int get_id() {
		return Id;
	}
	
	std::string get_command() {
		return Command;
	}

	std::string get_arguments() {
		return Argumets;
	}

	std::string get_file() {
		return File;
	}	
};

