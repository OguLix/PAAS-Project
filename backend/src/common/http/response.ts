import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '@ogulix/shared';

/** Success and error envelopes from docs/design/api-contract.md. */
export function successResponse<TData>(data: TData, requestId: string): ApiSuccessResponse<TData> {
  return { data, meta: { requestId } };
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: ApiErrorDetail[],
): ApiErrorResponse {
  return {
    error: details ? { code, message, details } : { code, message },
    meta: { requestId },
  };
}
