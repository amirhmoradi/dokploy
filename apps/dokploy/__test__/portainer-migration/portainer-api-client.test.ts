/**
 * Tests for Portainer API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
	PortainerApiClient,
	createPortainerApiClient,
	testPortainerConnection,
	PortainerApiError,
	type PortainerAuthConfig,
} from "@dokploy/server";

describe("PortainerApiClient", () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should normalize URL by removing trailing slashes", () => {
			const client = new PortainerApiClient({
				url: "https://portainer.example.com///",
				apiKey: "test-key",
			});

			// Access private baseUrl through any type assertion for testing
			expect((client as any).baseUrl).toBe("https://portainer.example.com");
		});

		it("should store API key when provided", () => {
			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			expect((client as any).apiKey).toBe("ptr_12345");
		});
	});

	describe("authenticate", () => {
		it("should skip authentication when API key is provided", async () => {
			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			await client.authenticate();

			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("should authenticate with username/password and store JWT", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ jwt: "test-jwt-token" }),
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				username: "admin",
				password: "password123",
			});

			await client.authenticate();

			expect(mockFetch).toHaveBeenCalledWith(
				"https://portainer.example.com/api/auth",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						username: "admin",
						password: "password123",
					}),
				}),
			);
			expect((client as any).authToken).toBe("test-jwt-token");
		});

		it("should throw error when authentication fails", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => "Invalid credentials",
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				username: "admin",
				password: "wrong-password",
			});

			await expect(client.authenticate()).rejects.toThrow(PortainerApiError);
		});

		it("should throw error when username/password not provided", async () => {
			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
			});

			await expect(client.authenticate()).rejects.toThrow(
				"Username and password are required for authentication",
			);
		});
	});

	describe("testConnection", () => {
		it("should return status when connection is successful", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					Version: "2.19.0",
					InstanceID: "test-instance-123",
				}),
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const status = await client.testConnection();

			expect(status).toEqual({
				Version: "2.19.0",
				InstanceID: "test-instance-123",
			});
		});
	});

	describe("getEndpoints", () => {
		it("should fetch all endpoints", async () => {
			const mockEndpoints = [
				{
					Id: 1,
					Name: "Local",
					Type: 1,
					URL: "tcp://localhost:2375",
					PublicURL: "",
					GroupId: 1,
					Status: 1,
				},
				{
					Id: 2,
					Name: "Production",
					Type: 2,
					URL: "tcp://prod.example.com:9001",
					PublicURL: "https://prod.example.com",
					GroupId: 2,
					Status: 1,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEndpoints,
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const endpoints = await client.getEndpoints();

			expect(endpoints).toEqual(mockEndpoints);
			expect(mockFetch).toHaveBeenCalledWith(
				"https://portainer.example.com/api/endpoints",
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-API-Key": "ptr_12345",
					}),
				}),
			);
		});
	});

	describe("getStacks", () => {
		it("should fetch all stacks", async () => {
			const mockStacks = [
				{
					Id: 1,
					Name: "webapp",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 1699999999,
				},
				{
					Id: 2,
					Name: "database",
					Type: 2,
					EndpointId: 1,
					Status: 1,
					CreationDate: 1699999998,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockStacks,
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const stacks = await client.getStacks();

			expect(stacks).toEqual(mockStacks);
		});
	});

	describe("getStackFile", () => {
		it("should fetch stack file content", async () => {
			const mockContent = `
version: "3.8"
services:
  web:
    image: nginx:latest
`;

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ StackFileContent: mockContent }),
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const content = await client.getStackFile(1);

			expect(content).toBe(mockContent);
		});
	});

	describe("getRegistries", () => {
		it("should fetch all registries", async () => {
			const mockRegistries = [
				{
					Id: 1,
					Type: 6,
					Name: "Docker Hub",
					URL: "docker.io",
					Authentication: true,
					Username: "user",
				},
				{
					Id: 2,
					Type: 3,
					Name: "Private Registry",
					URL: "registry.example.com",
					Authentication: true,
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockRegistries,
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const registries = await client.getRegistries();

			expect(registries).toEqual(mockRegistries);
		});
	});

	describe("getUsers", () => {
		it("should fetch all users", async () => {
			const mockUsers = [
				{ Id: 1, Username: "admin", Role: 1 },
				{ Id: 2, Username: "developer", Role: 2 },
				{ Id: 3, Username: "viewer", Role: 3 },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockUsers,
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const users = await client.getUsers();

			expect(users).toEqual(mockUsers);
		});
	});

	describe("getTeams", () => {
		it("should fetch all teams", async () => {
			const mockTeams = [
				{ Id: 1, Name: "DevOps" },
				{ Id: 2, Name: "Development" },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockTeams,
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			const teams = await client.getTeams();

			expect(teams).toEqual(mockTeams);
		});
	});

	describe("request error handling", () => {
		it("should throw PortainerApiError on non-ok response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: async () => "Not found",
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			await expect(client.getEndpoints()).rejects.toThrow(PortainerApiError);
		});

		it("should include status code in error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 403,
				text: async () => "Forbidden",
			});

			const client = new PortainerApiClient({
				url: "https://portainer.example.com",
				apiKey: "ptr_12345",
			});

			try {
				await client.getEndpoints();
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(PortainerApiError);
				expect((error as PortainerApiError).statusCode).toBe(403);
			}
		});
	});
});

describe("testPortainerConnection", () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it("should return success with version info", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				Version: "2.19.0",
				InstanceID: "instance-123",
			}),
		});

		const result = await testPortainerConnection({
			url: "https://portainer.example.com",
			apiKey: "ptr_12345",
		});

		expect(result).toEqual({
			success: true,
			version: "2.19.0",
			instanceId: "instance-123",
		});
	});

	it("should return error on failure", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Network error"));

		const result = await testPortainerConnection({
			url: "https://portainer.example.com",
			apiKey: "ptr_12345",
		});

		expect(result).toEqual({
			success: false,
			error: "Network error",
		});
	});
});

describe("createPortainerApiClient", () => {
	it("should create a client instance", () => {
		const client = createPortainerApiClient({
			url: "https://portainer.example.com",
			apiKey: "ptr_12345",
		});

		expect(client).toBeInstanceOf(PortainerApiClient);
	});
});
