import { describe, it, expect } from 'vitest';
import { Ok, Err, Result } from './result';

describe('Result', () => {
  describe('Ok', () => {
    it('should create a successful result with a value', () => {
      const result = Ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should work with string values', () => {
      const result = Ok('hello');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('hello');
      }
    });

    it('should work with object values', () => {
      const obj = { id: 1, name: 'test' };
      const result = Ok(obj);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(obj);
      }
    });

    it('should work with null value', () => {
      const result = Ok(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should work with undefined value', () => {
      const result = Ok(undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeUndefined();
      }
    });
  });

  describe('Err', () => {
    it('should create a failed result with an error', () => {
      const result = Err(new Error('something went wrong'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('something went wrong');
      }
    });

    it('should preserve the error instance', () => {
      const error = new Error('test error');
      const result = Err(error);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('should work with custom error types', () => {
      class ValidationError extends Error {
        constructor(
          message: string,
          public field: string,
        ) {
          super(message);
        }
      }
      const result = Err(new ValidationError('Invalid', 'email'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.field).toBe('email');
      }
    });
  });

  describe('Type narrowing', () => {
    it('should narrow to Ok type when ok is true', () => {
      const result: Result<number> = Ok(42);
      if (result.ok) {
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });

    it('should narrow to Err type when ok is false', () => {
      const result: Result<number> = Err(new Error('fail'));
      if (!result.ok) {
        const error: Error = result.error;
        expect(error.message).toBe('fail');
      }
    });

    it('should allow pattern matching style usage', () => {
      function process(result: Result<string>): string {
        if (result.ok) {
          return `Success: ${result.value}`;
        }
        return `Error: ${result.error.message}`;
      }

      expect(process(Ok('data'))).toBe('Success: data');
      expect(process(Err(new Error('oops')))).toBe('Error: oops');
    });
  });
});
