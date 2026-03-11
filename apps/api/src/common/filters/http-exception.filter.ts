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

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        if (Array.isArray(obj.message)) {
          errors = obj.message as string[];
          message = "Validation failed";
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error
          ? { err: exception }
          : { err: String(exception) },
        "Unhandled exception",
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
