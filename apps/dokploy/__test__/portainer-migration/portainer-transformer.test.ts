/**
 * Tests for Portainer to Dokploy Data Transformer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	PortainerTransformer,
	createTransformer,
	type MigrationAnalysis,
} from "@dokploy/server";
import type {
	PortainerEndpoint,
	PortainerEndpointGroup,
	PortainerRegistry,
	PortainerStack,
	PortainerTeam,
	PortainerTeamMembership,
	PortainerUser,
} from "@dokploy/server";

describe("PortainerTransformer", () => {
	let transformer: PortainerTransformer;

	beforeEach(() => {
		transformer = new PortainerTransformer();
	});

	describe("constructor", () => {
		it("should create instance without parameters", () => {
			const t = new PortainerTransformer();
			expect(t).toBeInstanceOf(PortainerTransformer);
		});

		it("should store endpoint groups", () => {
			const groups: PortainerEndpointGroup[] = [
				{
					Id: 1,
					Name: "Default",
					Description: "Default group",
					AuthorizedUsers: [],
					AuthorizedTeams: [],
					TagIds: [],
				},
			];

			const t = new PortainerTransformer(groups, []);
			expect((t as any).endpointGroups.get(1)).toEqual(groups[0]);
		});

		it("should group team memberships by team", () => {
			const memberships: PortainerTeamMembership[] = [
				{ Id: 1, UserID: 1, TeamID: 1, Role: 1 },
				{ Id: 2, UserID: 2, TeamID: 1, Role: 2 },
				{ Id: 3, UserID: 3, TeamID: 2, Role: 1 },
			];

			const t = new PortainerTransformer([], memberships);
			expect((t as any).teamMemberships.get(1)).toHaveLength(2);
			expect((t as any).teamMemberships.get(2)).toHaveLength(1);
		});
	});

	describe("analyzeData", () => {
		it("should return analysis with correct summary counts", () => {
			const data = {
				endpoints: [createMockEndpoint(1, "Local")],
				stacks: [createMockStack(1, "webapp")],
				registries: [createMockRegistry(1, "Docker Hub")],
				users: [createMockUser(1, "admin")],
				teams: [createMockTeam(1, "DevOps")],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.summary.totalEndpoints).toBe(1);
			expect(analysis.summary.totalStacks).toBe(1);
			expect(analysis.summary.totalRegistries).toBe(1);
			expect(analysis.summary.totalUsers).toBe(1);
			expect(analysis.summary.totalTeams).toBe(1);
		});

		it("should identify migratable items", () => {
			const data = {
				endpoints: [
					createMockEndpoint(1, "Docker", 1), // Docker - migratable
					createMockEndpoint(2, "K8s", 5), // Kubernetes - not migratable
				],
				stacks: [
					{ ...createMockStack(1, "webapp"), fileContent: "version: '3'" },
					{ ...createMockStack(2, "k8s-app"), Type: 3 }, // Kubernetes
				],
				registries: [createMockRegistry(1, "Docker Hub")],
				users: [createMockUser(1, "admin")],
				teams: [createMockTeam(1, "DevOps")],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.summary.migratable.endpoints).toBe(1);
			expect(analysis.summary.migratable.stacks).toBe(1);
		});

		it("should collect warnings and errors", () => {
			const data = {
				endpoints: [createMockEndpoint(1, "Azure ACI", 3)], // Azure - error
				stacks: [createMockStack(1, "webapp")], // No file content - error
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.summary.errors.length).toBeGreaterThan(0);
		});
	});

	describe("analyzeEndpoint", () => {
		it("should mark Docker endpoints as migratable", () => {
			const data = {
				endpoints: [createMockEndpoint(1, "Docker", 1)],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.endpoints[0].canMigrate).toBe(true);
			expect(analysis.endpoints[0].migrationNotes).toContain("Type: Docker");
		});

		it("should mark Docker Agent endpoints as migratable", () => {
			const data = {
				endpoints: [createMockEndpoint(1, "Agent", 2)],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.endpoints[0].canMigrate).toBe(true);
		});

		it("should mark Azure ACI as not migratable", () => {
			const data = {
				endpoints: [createMockEndpoint(1, "Azure", 3)],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.endpoints[0].canMigrate).toBe(false);
			expect(analysis.endpoints[0].warnings).toContain(
				"Azure ACI endpoints are not supported in Dokploy",
			);
		});

		it("should mark Kubernetes endpoints as not migratable", () => {
			const data = {
				endpoints: [
					createMockEndpoint(1, "K8s", 5),
					createMockEndpoint(2, "K8s Agent", 6),
					createMockEndpoint(3, "K8s Edge", 7),
				],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.endpoints[0].canMigrate).toBe(false);
			expect(analysis.endpoints[1].canMigrate).toBe(false);
			expect(analysis.endpoints[2].canMigrate).toBe(false);
		});

		it("should note TLS configuration", () => {
			const endpoint = createMockEndpoint(1, "Docker", 1);
			endpoint.TLSConfig = {
				TLS: true,
				TLSSkipVerify: true,
			};

			const data = {
				endpoints: [endpoint],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(
				analysis.endpoints[0].migrationNotes.some((n) =>
					n.includes("TLS enabled"),
				),
			).toBe(true);
			expect(analysis.endpoints[0].warnings).toContain(
				"TLS certificate verification is disabled",
			);
		});

		it("should warn about inactive endpoints", () => {
			const endpoint = createMockEndpoint(1, "Docker", 1);
			endpoint.Status = 2; // Inactive

			const data = {
				endpoints: [endpoint],
				stacks: [],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.endpoints[0].warnings).toContain(
				"Endpoint is not in active status",
			);
		});
	});

	describe("analyzeStack", () => {
		it("should mark compose stacks with content as migratable", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3.8'\nservices:\n  web:\n    image: nginx";

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.stacks[0].canMigrate).toBe(true);
		});

		it("should mark stacks without file content as not migratable", () => {
			const stack = createMockStack(1, "webapp");

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.stacks[0].canMigrate).toBe(false);
			expect(analysis.stacks[0].warnings).toContain(
				"Compose file content not available",
			);
		});

		it("should mark Kubernetes stacks as not migratable", () => {
			const stack = createMockStack(1, "k8s-app");
			stack.Type = 3;
			(stack as any).fileContent = "apiVersion: v1";

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.stacks[0].canMigrate).toBe(false);
		});

		it("should note git configuration", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.GitConfig = {
				URL: "https://github.com/user/repo.git",
				ReferenceName: "refs/heads/main",
			};

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(
				analysis.stacks[0].migrationNotes.some((n) => n.includes("Git source")),
			).toBe(true);
		});

		it("should warn about git authentication", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.GitConfig = {
				URL: "https://github.com/user/repo.git",
				Authentication: {
					Username: "user",
					Password: "pass",
					GitCredentialID: 1,
				},
			};

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.stacks[0].warnings).toContain(
				"Git authentication will need to be reconfigured",
			);
		});

		it("should note environment variables", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.Env = [
				{ name: "DB_HOST", value: "localhost" },
				{ name: "DB_PORT", value: "5432" },
			];

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(
				analysis.stacks[0].migrationNotes.some((n) =>
					n.includes("Environment variables: 2"),
				),
			).toBe(true);
		});

		it("should warn about additional files", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.AdditionalFiles = ["nginx.conf", "app.env"];

			const data = {
				endpoints: [],
				stacks: [stack],
				registries: [],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.summary.warnings.length).toBeGreaterThan(0);
		});
	});

	describe("analyzeRegistry", () => {
		it("should mark registries as migratable", () => {
			const data = {
				endpoints: [],
				stacks: [],
				registries: [createMockRegistry(1, "Docker Hub", 6)],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.registries[0].canMigrate).toBe(true);
		});

		it("should note authentication status", () => {
			const registry = createMockRegistry(1, "Private");
			registry.Authentication = true;
			registry.Username = "user";
			registry.Password = "pass";

			const data = {
				endpoints: [],
				stacks: [],
				registries: [registry],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(
				analysis.registries[0].migrationNotes.some((n) =>
					n.includes("Authentication enabled"),
				),
			).toBe(true);
		});

		it("should warn about missing credentials", () => {
			const registry = createMockRegistry(1, "Private");
			registry.Authentication = true;
			registry.Username = undefined;

			const data = {
				endpoints: [],
				stacks: [],
				registries: [registry],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.registries[0].warnings).toContain(
				"Credentials may need to be re-entered",
			);
		});

		it("should warn about AWS ECR", () => {
			const registry = createMockRegistry(1, "ECR", 7);

			const data = {
				endpoints: [],
				stacks: [],
				registries: [registry],
				users: [],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.registries[0].warnings).toContain(
				"AWS ECR may need additional configuration",
			);
		});
	});

	describe("analyzeUser", () => {
		it("should note user roles", () => {
			const data = {
				endpoints: [],
				stacks: [],
				registries: [],
				users: [
					createMockUser(1, "admin", 1),
					createMockUser(2, "user", 2),
					createMockUser(3, "readonly", 3),
				],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(
				analysis.users[0].migrationNotes.some((n) =>
					n.includes("Role: Administrator"),
				),
			).toBe(true);
			expect(
				analysis.users[1].migrationNotes.some((n) =>
					n.includes("Role: Standard User"),
				),
			).toBe(true);
			expect(
				analysis.users[2].migrationNotes.some((n) =>
					n.includes("Role: Read-Only User"),
				),
			).toBe(true);
		});

		it("should warn about external authentication", () => {
			const user = createMockUser(1, "ldap-user", 2);
			user.AuthenticationMethod = 2; // LDAP

			const data = {
				endpoints: [],
				stacks: [],
				registries: [],
				users: [user],
				teams: [],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.users[0].warnings).toContain(
				"Non-internal authentication will require reconfiguration",
			);
		});
	});

	describe("analyzeTeam", () => {
		it("should count team members", () => {
			const memberships: PortainerTeamMembership[] = [
				{ Id: 1, UserID: 1, TeamID: 1, Role: 1 },
				{ Id: 2, UserID: 2, TeamID: 1, Role: 2 },
			];

			const t = new PortainerTransformer([], memberships);

			const data = {
				endpoints: [],
				stacks: [],
				registries: [],
				users: [],
				teams: [createMockTeam(1, "DevOps")],
			};

			const analysis = t.analyzeData(data);

			expect(analysis.teams[0].memberCount).toBe(2);
		});

		it("should warn about empty teams", () => {
			const data = {
				endpoints: [],
				stacks: [],
				registries: [],
				users: [],
				teams: [createMockTeam(1, "Empty")],
			};

			const analysis = transformer.analyzeData(data);

			expect(analysis.teams[0].warnings).toContain("Team has no members");
		});
	});

	describe("transformEndpoint", () => {
		it("should transform Docker endpoint to server", () => {
			const endpoint = createMockEndpoint(1, "Production");
			endpoint.URL = "tcp://192.168.1.100:2375";

			const server = transformer.transformEndpoint(endpoint);

			expect(server).not.toBeNull();
			expect(server?.name).toBe("Production");
			expect(server?.ipAddress).toBe("192.168.1.100");
			expect(server?.serverType).toBe("deploy");
		});

		it("should return null for Kubernetes endpoints", () => {
			const endpoint = createMockEndpoint(1, "K8s", 5);

			const server = transformer.transformEndpoint(endpoint);

			expect(server).toBeNull();
		});

		it("should return null for Azure ACI", () => {
			const endpoint = createMockEndpoint(1, "Azure", 3);

			const server = transformer.transformEndpoint(endpoint);

			expect(server).toBeNull();
		});

		it("should handle unix socket URLs", () => {
			const endpoint = createMockEndpoint(1, "Local");
			endpoint.URL = "unix:///var/run/docker.sock";

			const server = transformer.transformEndpoint(endpoint);

			expect(server).not.toBeNull();
			expect(server?.ipAddress).toBe("127.0.0.1");
		});

		it("should use endpoint group description", () => {
			const groups: PortainerEndpointGroup[] = [
				{
					Id: 1,
					Name: "Production",
					Description: "Production servers",
					AuthorizedUsers: [],
					AuthorizedTeams: [],
					TagIds: [],
				},
			];

			const t = new PortainerTransformer(groups, []);
			const endpoint = createMockEndpoint(1, "Prod Server", 1);
			endpoint.GroupId = 1;

			const server = t.transformEndpoint(endpoint);

			expect(server?.description).toBe("Production servers");
		});
	});

	describe("transformStack", () => {
		it("should transform compose stack with file content", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3.8'\nservices:\n  web:\n    image: nginx";

			const compose = transformer.transformStack(stack, "env-123", "server-456");

			expect(compose).not.toBeNull();
			expect(compose?.name).toBe("webapp");
			expect(compose?.composeFile).toContain("version: '3.8'");
			expect(compose?.environmentId).toBe("env-123");
			expect(compose?.serverId).toBe("server-456");
			expect(compose?.sourceType).toBe("raw");
			expect(compose?.composeType).toBe("docker-compose");
		});

		it("should return null for stack without file content", () => {
			const stack = createMockStack(1, "webapp");

			const compose = transformer.transformStack(stack, "env-123");

			expect(compose).toBeNull();
		});

		it("should return null for Kubernetes stacks", () => {
			const stack = createMockStack(1, "k8s");
			stack.Type = 3;
			(stack as any).fileContent = "apiVersion: v1";

			const compose = transformer.transformStack(stack, "env-123");

			expect(compose).toBeNull();
		});

		it("should convert environment variables to string", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.Env = [
				{ name: "DB_HOST", value: "localhost" },
				{ name: "DB_PORT", value: "5432" },
			];

			const compose = transformer.transformStack(stack, "env-123");

			expect(compose?.env).toBe("DB_HOST=localhost\nDB_PORT=5432");
		});

		it("should set git source type when git config present", () => {
			const stack = createMockStack(1, "webapp");
			(stack as any).fileContent = "version: '3'";
			stack.GitConfig = {
				URL: "https://github.com/user/repo.git",
				ReferenceName: "refs/heads/develop",
			};

			const compose = transformer.transformStack(stack, "env-123");

			expect(compose?.sourceType).toBe("git");
			expect(compose?.customGitUrl).toBe("https://github.com/user/repo.git");
			expect(compose?.customGitBranch).toBe("refs/heads/develop");
		});

		it("should set stack type for swarm stacks", () => {
			const stack = createMockStack(1, "swarm-app");
			stack.Type = 1; // Swarm
			(stack as any).fileContent = "version: '3'";

			const compose = transformer.transformStack(stack, "env-123");

			expect(compose?.composeType).toBe("stack");
		});
	});

	describe("transformRegistry", () => {
		it("should transform Docker Hub registry", () => {
			const registry = createMockRegistry(1, "Docker Hub", 6);
			registry.URL = "docker.io";
			registry.Username = "myuser";
			registry.Password = "mypass";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.registryName).toBe("Docker Hub");
			expect(dokployRegistry.registryUrl).toBe("https://index.docker.io/v1/");
			expect(dokployRegistry.registryType).toBe("cloud");
			expect(dokployRegistry.username).toBe("myuser");
			expect(dokployRegistry.password).toBe("mypass");
		});

		it("should transform custom registry", () => {
			const registry = createMockRegistry(1, "Private", 3);
			registry.URL = "registry.company.com";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.registryType).toBe("selfHosted");
			expect(dokployRegistry.registryUrl).toBe("registry.company.com");
		});

		it("should identify GitHub registry as cloud", () => {
			const registry = createMockRegistry(1, "GitHub", 8);
			registry.URL = "ghcr.io";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.registryType).toBe("cloud");
			expect(dokployRegistry.registryUrl).toBe("https://ghcr.io");
		});

		it("should identify AWS ECR as cloud", () => {
			const registry = createMockRegistry(1, "ECR", 7);
			registry.URL = "123456789.dkr.ecr.us-east-1.amazonaws.com";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.registryType).toBe("cloud");
		});

		it("should identify Azure as cloud", () => {
			const registry = createMockRegistry(1, "Azure", 2);
			registry.URL = "myregistry.azurecr.io";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.registryType).toBe("cloud");
		});

		it("should include imagePrefix from BaseURL", () => {
			const registry = createMockRegistry(1, "Private", 3);
			registry.BaseURL = "myorg";

			const dokployRegistry = transformer.transformRegistry(registry);

			expect(dokployRegistry.imagePrefix).toBe("myorg");
		});
	});

	describe("transformUser", () => {
		it("should transform user with generated email", () => {
			const user = createMockUser(1, "john_doe");

			const dokployUser = transformer.transformUser(user);

			expect(dokployUser.name).toBe("john_doe");
			expect(dokployUser.email).toBe("johndoe@migrated.local");
		});

		it("should sanitize username for email", () => {
			const user = createMockUser(1, "User@Domain.COM");

			const dokployUser = transformer.transformUser(user);

			expect(dokployUser.email).toBe("userdomaincom@migrated.local");
		});
	});

	describe("getRoleForUser", () => {
		it("should return admin for administrator role", () => {
			const user = createMockUser(1, "admin", 1);

			const role = transformer.getRoleForUser(user);

			expect(role).toBe("admin");
		});

		it("should return member for standard user role", () => {
			const user = createMockUser(1, "user", 2);

			const role = transformer.getRoleForUser(user);

			expect(role).toBe("member");
		});

		it("should return member for read-only user role", () => {
			const user = createMockUser(1, "readonly", 3);

			const role = transformer.getRoleForUser(user);

			expect(role).toBe("member");
		});

		it("should return member for unknown roles", () => {
			const user = createMockUser(1, "unknown", 99);

			const role = transformer.getRoleForUser(user);

			expect(role).toBe("member");
		});
	});

	describe("getPermissionsForUser", () => {
		it("should return full permissions for admin", () => {
			const user = createMockUser(1, "admin", 1);

			const permissions = transformer.getPermissionsForUser(user);

			expect(permissions.canCreateProjects).toBe(true);
			expect(permissions.canAccessToSSHKeys).toBe(true);
			expect(permissions.canDeleteProjects).toBe(true);
			expect(permissions.canAccessToTraefikFiles).toBe(true);
		});

		it("should return limited permissions for standard user", () => {
			const user = createMockUser(1, "user", 2);

			const permissions = transformer.getPermissionsForUser(user);

			expect(permissions.canCreateProjects).toBe(false);
			expect(permissions.canCreateServices).toBe(true);
			expect(permissions.canDeleteServices).toBe(true);
			expect(permissions.canAccessToDocker).toBe(true);
		});

		it("should return restricted permissions for read-only user", () => {
			const user = createMockUser(1, "readonly", 3);

			const permissions = transformer.getPermissionsForUser(user);

			expect(permissions.canCreateProjects).toBe(false);
			expect(permissions.canCreateServices).toBe(false);
			expect(permissions.canDeleteServices).toBe(false);
			expect(permissions.canAccessToDocker).toBe(false);
		});
	});

	describe("transformEndpointGroup", () => {
		it("should transform endpoint group to project", () => {
			const group: PortainerEndpointGroup = {
				Id: 1,
				Name: "Production",
				Description: "Production environment",
				AuthorizedUsers: [],
				AuthorizedTeams: [],
				TagIds: [],
			};

			const project = transformer.transformEndpointGroup(group);

			expect(project.name).toBe("Production");
			expect(project.description).toBe("Production environment");
		});

		it("should handle missing description", () => {
			const group: PortainerEndpointGroup = {
				Id: 1,
				Name: "Production",
				Description: "",
				AuthorizedUsers: [],
				AuthorizedTeams: [],
				TagIds: [],
			};

			const project = transformer.transformEndpointGroup(group);

			expect(project.description).toContain("Migrated from Portainer");
		});
	});
});

describe("createTransformer", () => {
	it("should create transformer instance", () => {
		const t = createTransformer();
		expect(t).toBeInstanceOf(PortainerTransformer);
	});

	it("should create transformer with endpoint groups and memberships", () => {
		const groups: PortainerEndpointGroup[] = [
			{
				Id: 1,
				Name: "Default",
				Description: "",
				AuthorizedUsers: [],
				AuthorizedTeams: [],
				TagIds: [],
			},
		];

		const memberships: PortainerTeamMembership[] = [
			{ Id: 1, UserID: 1, TeamID: 1, Role: 1 },
		];

		const t = createTransformer(groups, memberships);

		expect(t).toBeInstanceOf(PortainerTransformer);
		expect((t as any).endpointGroups.size).toBe(1);
		expect((t as any).teamMemberships.size).toBe(1);
	});
});

// Helper functions to create mock data
function createMockEndpoint(
	id: number,
	name: string,
	type = 1,
): PortainerEndpoint {
	return {
		Id: id,
		Name: name,
		Type: type,
		URL: "tcp://localhost:2375",
		PublicURL: "",
		GroupId: 1,
		Status: 1,
		AuthorizedUsers: [],
		AuthorizedTeams: [],
		TagIds: [],
	};
}

function createMockStack(id: number, name: string): PortainerStack {
	return {
		Id: id,
		Name: name,
		Type: 2, // Compose
		EndpointId: 1,
		Status: 1,
		CreationDate: Date.now(),
	};
}

function createMockRegistry(
	id: number,
	name: string,
	type = 3,
): PortainerRegistry {
	return {
		Id: id,
		Name: name,
		Type: type,
		URL: "registry.example.com",
		Authentication: false,
	};
}

function createMockUser(id: number, username: string, role = 2): PortainerUser {
	return {
		Id: id,
		Username: username,
		Role: role,
	};
}

function createMockTeam(id: number, name: string): PortainerTeam {
	return {
		Id: id,
		Name: name,
	};
}
