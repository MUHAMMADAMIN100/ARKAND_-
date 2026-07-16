import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: { field: string; message: string }[];
  path: string;
  timestamp: string;
}

/** Единый формат ошибок + маппинг ошибок Prisma в человеческие 4xx. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';
    let errors: ErrorBody['errors'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? message;
        errors = r.errors as ErrorBody['errors'];
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Некорректный тип/значение параметра (напр. битый UUID) — это ошибка клиента, не 500.
      status = HttpStatus.BAD_REQUEST;
      message = 'Некорректные данные запроса';
    }
    // Для всех прочих (неизвестных) ошибок клиенту уходит обобщённое сообщение —
    // внутренние детали (текст ошибки, стек) только в лог, наружу не текут.

    if (status >= 500) {
      const internal = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.url} → ${status}: ${internal}`, (exception as Error)?.stack);
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): { status: number; message: string } {
    switch (e.code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'Запись с такими данными уже существует' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Запись не найдена' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Нарушение связи между записями' };
      case 'P2023':
        return { status: HttpStatus.BAD_REQUEST, message: 'Некорректный идентификатор' };
      default:
        return { status: HttpStatus.BAD_REQUEST, message: 'Ошибка базы данных' };
    }
  }
}
