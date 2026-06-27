import type { RequestMessage, ResponseMessage } from '@/shared/messages';

export type HandlerMap = Partial<Record<RequestMessage['type'], (req: any) => Promise<unknown>>>;

export async function routeMessage(
  handlers: HandlerMap,
  req: RequestMessage
): Promise<ResponseMessage> {
  const handler = handlers[req.type];
  if (!handler) {
    return { type: 'ERROR', error: { code: 'MODEL_ERROR' as any, message: `未知消息类型: ${req.type}`, retryable: false } };
  }
  try {
    const data = await handler(req);
    return { type: 'SUCCESS', data };
  } catch (e: any) {
    if (typeof e?.toResponse === 'function') {
      return { type: 'ERROR', error: e.toResponse() };
    }
    return { type: 'ERROR', error: { code: 'MODEL_ERROR' as any, message: e?.message ?? '未知错误', retryable: false } };
  }
}
