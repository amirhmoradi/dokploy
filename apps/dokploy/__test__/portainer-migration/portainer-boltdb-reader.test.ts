/**
 * Tests for Portainer BoltDB Reader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as childProcess from "child_process";
import type { EventEmitter } from "events";

// Mock fs and child_process
vi.mock("fs", async () => {
	const actual = await vi.importActual<typeof fs>("fs");
	return {
		...actual,
		existsSync: vi.fn(),
		promises: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
			mkdir: vi.fn(),
			rm: vi.fn(),
			stat: vi.fn(),
			open: vi.fn(),
			unlink: vi.fn(),
		},
	};
});

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}));

// Import after mocking
import {
	PortainerBoltDbReader,
	BoltDbError,
	createBoltDbReader,
	testBoltDbFile,
	type BoltDbConfig,
} from "@dokploy/server";

describe("PortainerBoltDbReader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create instance when file exists", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			expect(reader).toBeInstanceOf(PortainerBoltDbReader);
		});

		it("should throw BoltDbError when file does not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			expect(() => {
				new PortainerBoltDbReader({
					dbPath: "/path/to/nonexistent.db",
				});
			}).toThrow(BoltDbError);
		});

		it("should store stackFilesPath when provided", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const config: BoltDbConfig = {
				dbPath: "/path/to/portainer.db",
				stackFilesPath: "/path/to/stacks",
			};

			const reader = new PortainerBoltDbReader(config);

			expect((reader as any).stackFilesPath).toBe("/path/to/stacks");
		});
	});

	describe("readAll", () => {
		it("should return empty data when buckets are empty", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			// Mock bbolt command to return empty buckets
			const mockProcess = createMockProcess("", "");
			vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);

			const data = await reader.readAll();

			expect(data.endpoints).toEqual([]);
			expect(data.stacks).toEqual([]);
			expect(data.registries).toEqual([]);
			expect(data.users).toEqual([]);
			expect(data.teams).toEqual([]);
		});

		it("should extract and parse data from bbolt", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			// Mock bucket listing
			let callCount = 0;
			vi.mocked(childProcess.spawn).mockImplementation((_cmd, args) => {
				callCount++;
				if (args && args[0] === "buckets") {
					return createMockProcess("endpoints\nstacks\n", "") as any;
				}
				if (args && args[0] === "keys" && args[2] === "endpoints") {
					return createMockProcess("1\n", "") as any;
				}
				if (args && args[0] === "keys" && args[2] === "stacks") {
					return createMockProcess("1\n", "") as any;
				}
				if (args && args[0] === "get" && args[2] === "endpoints") {
					return createMockProcess(
						JSON.stringify({
							Id: 1,
							Name: "Local",
							Type: 1,
							URL: "tcp://localhost:2375",
							Status: 1,
						}),
						"",
					) as any;
				}
				if (args && args[0] === "get" && args[2] === "stacks") {
					return createMockProcess(
						JSON.stringify({
							Id: 1,
							Name: "webapp",
							Type: 2,
							EndpointId: 1,
							Status: 1,
						}),
						"",
					) as any;
				}
				return createMockProcess("", "") as any;
			});

			const data = await reader.readAll();

			expect(data.endpoints.length).toBe(1);
			expect(data.endpoints[0].Name).toBe("Local");
			expect(data.stacks.length).toBe(1);
			expect(data.stacks[0].Name).toBe("webapp");
		});
	});

	describe("parseEndpoints", () => {
		it("should parse endpoints with various field name formats", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Name: "Endpoint 1",
					Type: 1,
					URL: "tcp://localhost:2375",
					Status: 1,
				},
				"2": {
					id: 2,
					name: "Endpoint 2",
					type: 2,
					url: "tcp://remote:2375",
					status: 2,
				},
			};

			const endpoints = (reader as any).parseEndpoints(data);

			expect(endpoints).toHaveLength(2);
			expect(endpoints[0]).toMatchObject({
				Id: 1,
				Name: "Endpoint 1",
				Type: 1,
				URL: "tcp://localhost:2375",
			});
			expect(endpoints[1]).toMatchObject({
				Id: 2,
				Name: "Endpoint 2",
				Type: 2,
				URL: "tcp://remote:2375",
			});
		});

		it("should handle missing fields with defaults", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": { Name: "Minimal" },
			};

			const endpoints = (reader as any).parseEndpoints(data);

			expect(endpoints[0]).toMatchObject({
				Id: 0,
				Name: "Minimal",
				Type: 1,
				URL: "",
				GroupId: 1,
				Status: 1,
			});
		});
	});

	describe("parseStacks", () => {
		it("should parse stacks with all fields", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Name: "webapp",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 1699999999,
					ProjectPath: "/data/compose/1",
					EntryPoint: "docker-compose.yml",
					Env: [{ name: "ENV_VAR", value: "value" }],
				},
			};

			const stacks = (reader as any).parseStacks(data);

			expect(stacks[0]).toMatchObject({
				Id: 1,
				Name: "webapp",
				Type: 2,
				EndpointId: 1,
				ProjectPath: "/data/compose/1",
				EntryPoint: "docker-compose.yml",
			});
			expect(stacks[0].Env).toHaveLength(1);
		});

		it("should handle git-based stacks", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Name: "git-stack",
					Type: 2,
					GitConfig: {
						URL: "https://github.com/user/repo.git",
						ReferenceName: "refs/heads/main",
						ConfigFilePath: "docker-compose.yml",
					},
					AutoUpdate: {
						Interval: "5m",
					},
				},
			};

			const stacks = (reader as any).parseStacks(data);

			expect(stacks[0].GitConfig).toBeDefined();
			expect(stacks[0].GitConfig?.URL).toBe("https://github.com/user/repo.git");
		});
	});

	describe("parseRegistries", () => {
		it("should parse registries correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Type: 6,
					Name: "Docker Hub",
					URL: "docker.io",
					Authentication: true,
					Username: "user",
				},
				"2": {
					Id: 2,
					Type: 3,
					Name: "Private Registry",
					URL: "registry.example.com",
					Authentication: true,
					Username: "admin",
					Password: "secret",
				},
			};

			const registries = (reader as any).parseRegistries(data);

			expect(registries).toHaveLength(2);
			expect(registries[0].Name).toBe("Docker Hub");
			expect(registries[0].Authentication).toBe(true);
			expect(registries[1].Password).toBe("secret");
		});
	});

	describe("parseUsers", () => {
		it("should parse users correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Username: "admin",
					Role: 1,
				},
				"2": {
					Id: 2,
					Username: "developer",
					Role: 2,
					AuthenticationMethod: 1,
				},
			};

			const users = (reader as any).parseUsers(data);

			expect(users).toHaveLength(2);
			expect(users[0].Username).toBe("admin");
			expect(users[0].Role).toBe(1);
			expect(users[1].Role).toBe(2);
		});
	});

	describe("parseTeams", () => {
		it("should parse teams correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": { Id: 1, Name: "DevOps" },
				"2": { Id: 2, Name: "Development" },
			};

			const teams = (reader as any).parseTeams(data);

			expect(teams).toHaveLength(2);
			expect(teams[0].Name).toBe("DevOps");
			expect(teams[1].Name).toBe("Development");
		});
	});

	describe("parseTeamMemberships", () => {
		it("should parse team memberships correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					UserID: 2,
					TeamID: 1,
					Role: 1,
				},
			};

			const memberships = (reader as any).parseTeamMemberships(data);

			expect(memberships).toHaveLength(1);
			expect(memberships[0].UserID).toBe(2);
			expect(memberships[0].TeamID).toBe(1);
		});
	});

	describe("parseEndpointGroups", () => {
		it("should parse endpoint groups correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					Name: "Default",
					Description: "Default group",
				},
				"2": {
					Id: 2,
					Name: "Production",
					Description: "Production endpoints",
					TagIds: [1, 2],
				},
			};

			const groups = (reader as any).parseEndpointGroups(data);

			expect(groups).toHaveLength(2);
			expect(groups[0].Name).toBe("Default");
			expect(groups[1].TagIds).toEqual([1, 2]);
		});
	});

	describe("parseResourceControls", () => {
		it("should parse resource controls correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					Id: 1,
					ResourceId: "container-123",
					Type: 1,
					Public: false,
					System: false,
				},
			};

			const controls = (reader as any).parseResourceControls(data);

			expect(controls).toHaveLength(1);
			expect(controls[0].ResourceId).toBe("container-123");
		});
	});

	describe("parseSettings", () => {
		it("should parse settings correctly", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const data = {
				"1": {
					LogoURL: "https://example.com/logo.png",
					EnableTelemetry: true,
					SnapshotInterval: "5m",
					TemplatesURL: "https://templates.example.com",
				},
			};

			const settings = (reader as any).parseSettings(data);

			expect(settings).toBeDefined();
			expect(settings?.LogoURL).toBe("https://example.com/logo.png");
			expect(settings?.EnableTelemetry).toBe(true);
		});

		it("should return undefined when no settings", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const settings = (reader as any).parseSettings({});

			expect(settings).toBeUndefined();
		});
	});

	describe("enrichStacksWithFileContent", () => {
		it("should add file content when stack files exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.promises.readFile).mockResolvedValue(
				"version: '3.8'\nservices:\n  web:\n    image: nginx",
			);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
				stackFilesPath: "/path/to/data",
			});

			const stacks = [
				{
					Id: 1,
					Name: "webapp",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 123456789,
				},
			];

			const enriched = await (reader as any).enrichStacksWithFileContent(stacks);

			expect(enriched[0].fileContent).toContain("version: '3.8'");
		});

		it("should return undefined fileContent when no stackFilesPath", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
			});

			const stacks = [
				{
					Id: 1,
					Name: "webapp",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 123456789,
				},
			];

			const enriched = await (reader as any).enrichStacksWithFileContent(stacks);

			expect(enriched[0].fileContent).toBeUndefined();
		});

		it("should handle missing files gracefully", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.promises.readFile).mockRejectedValue(
				new Error("File not found"),
			);

			const reader = new PortainerBoltDbReader({
				dbPath: "/path/to/portainer.db",
				stackFilesPath: "/path/to/data",
			});

			const stacks = [
				{
					Id: 1,
					Name: "webapp",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 123456789,
				},
			];

			const enriched = await (reader as any).enrichStacksWithFileContent(stacks);

			expect(enriched[0].fileContent).toBeUndefined();
		});
	});
});

describe("BoltDbError", () => {
	it("should create error with message and code", () => {
		const error = new BoltDbError("Test error", "TEST_CODE");

		expect(error.message).toBe("Test error");
		expect(error.code).toBe("TEST_CODE");
		expect(error.name).toBe("BoltDbError");
	});

	it("should create error with details", () => {
		const details = { extra: "info" };
		const error = new BoltDbError("Test error", "TEST_CODE", details);

		expect(error.details).toEqual(details);
	});
});

describe("createBoltDbReader", () => {
	it("should create a reader instance", () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);

		const reader = createBoltDbReader({
			dbPath: "/path/to/portainer.db",
		});

		expect(reader).toBeInstanceOf(PortainerBoltDbReader);
	});
});

describe("testBoltDbFile", () => {
	it("should return valid for existing file", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.promises.stat).mockResolvedValue({
			isFile: () => true,
		} as fs.Stats);

		const mockFd = {
			read: vi.fn().mockResolvedValue({ bytesRead: 16 }),
			close: vi.fn().mockResolvedValue(undefined),
		};
		vi.mocked(fs.promises.open).mockResolvedValue(mockFd as any);

		const result = await testBoltDbFile("/path/to/portainer.db");

		expect(result.valid).toBe(true);
	});

	it("should return invalid when file not found", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);

		const result = await testBoltDbFile("/path/to/nonexistent.db");

		expect(result.valid).toBe(false);
		expect(result.error).toBe("File not found");
	});

	it("should return invalid when path is not a file", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.promises.stat).mockResolvedValue({
			isFile: () => false,
		} as fs.Stats);

		const result = await testBoltDbFile("/path/to/directory");

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Path is not a file");
	});

	it("should handle errors gracefully", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.promises.stat).mockRejectedValue(new Error("Access denied"));

		const result = await testBoltDbFile("/path/to/portainer.db");

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Access denied");
	});
});

// Helper to create mock process for spawn
function createMockProcess(stdout: string, stderr: string, exitCode = 0) {
	const stdoutEmitter = {
		on: vi.fn((event: string, callback: (data: Buffer) => void) => {
			if (event === "data") {
				setTimeout(() => callback(Buffer.from(stdout)), 0);
			}
		}),
	};

	const stderrEmitter = {
		on: vi.fn((event: string, callback: (data: Buffer) => void) => {
			if (event === "data" && stderr) {
				setTimeout(() => callback(Buffer.from(stderr)), 0);
			}
		}),
	};

	const processEmitter = {
		stdout: stdoutEmitter,
		stderr: stderrEmitter,
		on: vi.fn((event: string, callback: (...args: any[]) => void) => {
			if (event === "close") {
				setTimeout(() => callback(exitCode), 10);
			}
		}),
	};

	return processEmitter;
}
