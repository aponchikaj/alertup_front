import axios from 'axios';
import { getRoute } from './routeService';

// Mock axios
jest.mock('axios');

describe('routeService - getRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid Requests', () => {
    test('should successfully fetch route with valid QR ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 100, y: 100, type: 'path' },
            { x: 200, y: 200, type: 'exit' },
          ],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('test-qr-id'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(Array.isArray(result.route)).toBe(true);
    });

    test('should include axios timeout configuration', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await getRoute('test-qr-id');

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 15000,
        })
      );
    });

    test('should encode QR ID properly in URL', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const specialId = 'qr/id+with special chars';
      await getRoute(specialId);

      // Should encode the QR ID
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(specialId)),
        expect.any(Object)
      );
    });

    test('should return complete response with all expected fields', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 100, y: 100, type: 'path', label: 'Start' },
            { x: 500, y: 500, type: 'exit', label: 'Exit' },
          ],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 1000, height: 800 },
          svgContent: '<rect />',
          building: 'Building A',
          floor: 1,
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('route');
      expect(result).toHaveProperty('startPoint');
      expect(result).toHaveProperty('svgDimensions');
    });
  });

  describe('Input Validation', () => {
    test('should reject null QR ID', async () => {
      await expect(getRoute(null as any)).rejects.toThrow();
    });

    test('should reject undefined QR ID', async () => {
      await expect(getRoute(undefined as any)).rejects.toThrow();
    });

    test('should reject empty string QR ID', async () => {
      await expect(getRoute('')).rejects.toThrow();
    });

    test('should reject QR ID exceeding maximum length', async () => {
      const tooLongId = 'a'.repeat(500);
      await expect(getRoute(tooLongId)).rejects.toThrow();
    });

    test('should accept QR ID with maximum valid length', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const maxValidId = 'a'.repeat(499);
      const result = await getRoute(maxValidId);

      expect(axios.get).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should handle QR ID with special characters', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const specialId = 'qr-123_456!@#$%';
      await getRoute(specialId);

      expect(axios.get).toHaveBeenCalled();
    });

    test('should handle QR ID with unicode characters', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const unicodeId = 'qr-测试-id';
      await getRoute(unicodeId);

      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('Response Validation', () => {
    test('should validate response structure before returning', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 100, y: 100, type: 'path' },
            { x: 200, y: 200, type: 'exit' },
          ],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      // Should have proper validation
      expect(result).toBeDefined();
      expect(Array.isArray(result.route)).toBe(true);
    });

    test('should validate route array contains valid node objects', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 100, y: 100, type: 'path' },
            { x: 200, y: 200, type: 'exit' },
          ],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      result.route.forEach((node: any) => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(typeof node.type).toBe('string');
      });
    });

    test('should reject response with missing route field', async () => {
      const mockResponse = {
        data: {
          success: true,
          // route is missing
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should reject response with non-array route', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: { x: 100, y: 100 }, // Not an array
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should reject response with missing required fields', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'path' }],
          // Missing startPoint or svgDimensions
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should validate startPoint coordinates are numbers', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'path' }],
          startPoint: { x: 'invalid', y: 100 }, // x is string
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should validate svgDimensions are positive numbers', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'path' }],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: -800, height: 600 }, // Invalid width
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      const networkError = new Error('Network Error');

      (axios.get as jest.Mock).mockRejectedValue(networkError);

      await expect(getRoute('test-qr-id')).rejects.toThrow('Network Error');
    });

    test('should handle 404 not found errors', async () => {
      const error = new Error('404 Not Found');
      (error as any).response = { status: 404 };

      (axios.get as jest.Mock).mockRejectedValue(error);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should handle 500 server errors', async () => {
      const error = new Error('500 Internal Server Error');
      (error as any).response = { status: 500 };

      (axios.get as jest.Mock).mockRejectedValue(error);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      (axios.get as jest.Mock).mockRejectedValue(timeoutError);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should handle malformed JSON responses', async () => {
      const error = new Error('Invalid JSON');

      (axios.get as jest.Mock).mockRejectedValue(error);

      await expect(getRoute('test-qr-id')).rejects.toThrow();
    });

    test('should not expose internal axios error details', async () => {
      const error = new Error('Database connection failed');

      (axios.get as jest.Mock).mockRejectedValue(error);

      try {
        await getRoute('test-qr-id');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).not.toContain('axios');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty route array', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [], // Empty route
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result.route).toEqual([]);
    });

    test('should handle route with single node', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'exit' }],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result.route.length).toBe(1);
    });

    test('should handle very large route arrays', async () => {
      const largeRoute = Array.from({ length: 1000 }, (_, i) => ({
        x: i * 10,
        y: i * 10,
        type: 'path',
      }));

      const mockResponse = {
        data: {
          success: true,
          route: largeRoute,
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 10000, height: 10000 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result.route.length).toBe(1000);
    });

    test('should handle coordinates with many decimal places', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 123.456789123456, y: 987.654321098765, type: 'path' },
            { x: 0.000000000001, y: 999.999999999999, type: 'exit' },
          ],
          startPoint: { x: 123.456789123456, y: 987.654321098765 },
          svgDimensions: { width: 1000.5, height: 800.3 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result.route[0].x).toBeCloseTo(123.456789123456, 5);
      expect(result.svgDimensions.width).toBe(1000.5);
    });

    test('should handle optional fields in response', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [
            { x: 100, y: 100, type: 'path', label: 'Start' }, // With label
            { x: 200, y: 200, type: 'exit' }, // Without label
          ],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
          svgContent: '<rect />', // Optional field
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result.route[0].label).toBe('Start');
      expect(result.route[1].label).toBeUndefined();
      expect(result.svgContent).toBe('<rect />');
    });

    test('should handle response with null optional fields', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'path' }],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
          svgContent: null,
          building: null,
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getRoute('test-qr-id');

      expect(result).toBeDefined();
      expect(result.route).toBeDefined();
    });
  });

  describe('Performance and Timeout', () => {
    test('should complete request within timeout period', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [{ x: 100, y: 100, type: 'path' }],
          startPoint: { x: 100, y: 100 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      const startTime = Date.now();

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await getRoute('test-qr-id');

      const endTime = Date.now();

      // Should complete much faster than timeout
      expect(endTime - startTime).toBeLessThan(15000);
    });

    test('should have correct timeout value in axios config', async () => {
      const mockResponse = {
        data: {
          success: true,
          route: [],
          startPoint: { x: 0, y: 0 },
          svgDimensions: { width: 800, height: 600 },
        },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      await getRoute('test-qr-id');

      const callArgs = (axios.get as jest.Mock).mock.calls[0];
      expect(callArgs[1].timeout).toBe(15000);
    });
  });
});
