import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type ApiResponse = {
  data: unknown;
  meta?: unknown;
};

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (this.isApiResponse(value)) {
          return value;
        }

        return { data: value };
      }),
    );
  }

  private isApiResponse(value: unknown): value is ApiResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      Object.keys(value).every((key) => key === 'data' || key === 'meta')
    );
  }
}
