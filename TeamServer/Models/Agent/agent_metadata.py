class AgentMetadata:
    def __init__(self, id, hostname, username, processname, pid, integrity, arch):
        self.id = id
        self.hostname = hostname
        self.username = username
        self.processname = processname
        self.pid = pid
        self.integrity = integrity
        self.arch = arch

    def get_id(self):
        return self.id

    def set_id(self, value):
        self.id = value

    def get_hostname(self):
        return self.hostname

    def set_hostname(self, value):
        self.hostname = value

    def get_username(self):
        return self.username

    def set_username(self, value):
        self.username = value

    def get_processname(self):
        return self.processname

    def set_processname(self, value):
        self.processname = value

    def get_pid(self):
        return self.pid

    def set_pid(self, value):
        self.pid = value

    def get_integryty(self):
        return self.integryty

    def set_integrity(self, value):
        self.integrity = value

    def get_arch(self):
        return self.arch

    def set_arch(self, value):
        self.arch = value

    def to_dict(self):
        return {
            "id": self.id,
            "hostname": self.hostname,
            "username": self.username,
            "processname": self.processname,
            "pid": self.pid,
            "integrity": self.integrity,
            "arch": self.arch
        }