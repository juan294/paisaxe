import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock fs/promises
const { mockReadFile, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("fs/promises", () => {
  const mock = {
    readFile: mockReadFile,
    stat: mockStat,
  };
  return {
    ...mock,
    default: mock,
  };
});

describe("GET /api/content-images/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("path validation", () => {
    it("should return 400 when path is empty", async () => {
      const request = new NextRequest("http://localhost:3000/api/content-images");
      const response = await GET(request, { params: Promise.resolve({ path: [] }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Path is required");
    });

    it("should return 400 for directory traversal attempts with ..", async () => {
      const request = new NextRequest("http://localhost:3000/api/content-images/../etc/passwd");
      const response = await GET(request, {
        params: Promise.resolve({ path: ["..", "etc", "passwd"] }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid path");
    });

    it("should return 400 for path segments with dots", async () => {
      const request = new NextRequest("http://localhost:3000/api/content-images/./test.png");
      const response = await GET(request, {
        params: Promise.resolve({ path: [".", "test.png"] }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid path");
    });

    it("should return 400 for unsupported file types", async () => {
      const request = new NextRequest("http://localhost:3000/api/content-images/test.pdf");
      const response = await GET(request, {
        params: Promise.resolve({ path: ["test.pdf"] }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Unsupported file type");
    });
  });

  describe("successful image serving", () => {
    const mockImageBuffer = Buffer.from("fake-image-data");

    it("should serve PNG images with correct content type", async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/test-folder/image.png"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["test-folder", "image.png"] }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=31536000, immutable"
      );
    });

    it("should serve JPEG images with correct content type", async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/test-folder/photo.jpg"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["test-folder", "photo.jpg"] }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    });

    it("should serve WebP images with correct content type", async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/test-folder/image.webp"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["test-folder", "image.webp"] }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
    });

    it("should handle nested paths correctly", async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/pdf-name/subfolder/image.png"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["pdf-name", "subfolder", "image.png"] }),
      });

      expect(response.status).toBe(200);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining("pdf-name/subfolder/image.png")
      );
    });
  });

  describe("error handling", () => {
    it("should return 404 when file is not found", async () => {
      const notFoundError = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
      notFoundError.code = "ENOENT";
      mockStat.mockRejectedValue(notFoundError);

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/nonexistent.png"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["nonexistent.png"] }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Image not found");
    });

    it("should return 400 when path is a directory", async () => {
      mockStat.mockResolvedValue({ isFile: () => false });

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/folder.png"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["folder.png"] }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Not a file");
    });

    it("should return 500 on unexpected errors", async () => {
      mockStat.mockRejectedValue(new Error("Unexpected error"));

      const request = new NextRequest(
        "http://localhost:3000/api/content-images/test.png"
      );
      const response = await GET(request, {
        params: Promise.resolve({ path: ["test.png"] }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to serve image");
    });
  });
});
