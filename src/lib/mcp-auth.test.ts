import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateMcpSecret } from "./mcp-auth";

const originalEnv = process.env;

describe("validateMcpSecret", () => {
  const MCP_SECRET = "test-mcp-secret-value";

  beforeEach(() => {
    process.env = { ...originalEnv, MCP_API_SECRET: MCP_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return true when the provided secret matches", () => {
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": MCP_SECRET },
    });
    expect(validateMcpSecret(request)).toBe(true);
  });

  it("should return false when the provided secret does not match", () => {
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": "wrong-secret" },
    });
    expect(validateMcpSecret(request)).toBe(false);
  });

  it("should return false when x-mcp-secret header is missing", () => {
    const request = new Request("http://localhost:3000/api/mcp/test");
    expect(validateMcpSecret(request)).toBe(false);
  });

  it("should return false when MCP_API_SECRET env var is not set", () => {
    delete process.env.MCP_API_SECRET;
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": "any-value" },
    });
    expect(validateMcpSecret(request)).toBe(false);
  });

  it("should return false when MCP_API_SECRET is empty string", () => {
    process.env.MCP_API_SECRET = "";
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": "" },
    });
    expect(validateMcpSecret(request)).toBe(false);
  });

  it("should handle secrets with different lengths safely", () => {
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": "short" },
    });
    expect(validateMcpSecret(request)).toBe(false);
  });

  it("should trim whitespace from MCP_API_SECRET env var", () => {
    process.env.MCP_API_SECRET = "  secret-with-spaces  ";
    const request = new Request("http://localhost:3000/api/mcp/test", {
      headers: { "x-mcp-secret": "secret-with-spaces" },
    });
    expect(validateMcpSecret(request)).toBe(true);
  });
});
