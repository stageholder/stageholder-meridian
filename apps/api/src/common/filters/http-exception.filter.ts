import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new PinoLogger({
    renameContext: GlobalExceptionFilter.name,
  });

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.url;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // String body → wrap it as the message and ship.
      if (typeof body === "string") {
        res
          .status(status)
          .json({ statusCode: status, message: body, timestamp, path });
        return;
      }

      // Object body → preserve the original fields. NestJS HttpExceptions
      // throw with structured payloads (paywall info, validation errors,
      // auth reasons, etc.) and the client needs those fields. Earlier we
      // extracted only `message`, which destroyed any 402 body the SDK's
      // axios interceptor relies on for the paywall modal. Now we spread
      // the original body and only override / supplement.
      if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>;

        // ValidationPipe puts an array of strings under `message` —
        // surface that as `errors` and replace `message` with a generic
        // "Validation failed" so existing callers stay compatible.
        if (Array.isArray(obj.message)) {
          res.status(status).json({
            statusCode: status,
            ...obj,
            message: "Validation failed",
            errors: obj.message,
            timestamp,
            path,
          });
          return;
        }

        res.status(status).json({
          statusCode: status,
          ...obj,
          timestamp,
          path,
        });
        return;
      }

      // Fallback — unusual body type.
      res.status(status).json({
        statusCode: status,
        message: "Request failed",
        timestamp,
        path,
      });
      return;
    }

    // Non-HttpException — log loudly and return generic 500.
    this.logger.error(
      exception instanceof Error
        ? { err: exception }
        : { err: String(exception) },
      "Unhandled exception",
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      timestamp,
      path,
    });
  }
}
