import type { Request, Response } from 'express';

/**
 * Server-Sent Events that start lazily: headers go out with the first event, so
 * a handler can still answer with an ordinary JSON error if it fails before
 * streaming anything. `signal` aborts when the client disconnects.
 */
export function lazySse(req: Request, res: Response) {
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  let started = false;

  const send = (event: string, data: unknown) => {
    if (!started) {
      started = true;
      (req.headers as Record<string, string>)['x-no-compression'] = '1'; // compression would buffer the stream
      res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  /** Report a failure: JSON if nothing was streamed yet, otherwise an `error` event. */
  const fail = (status: number, message: string) => {
    if (controller.signal.aborted) return;
    if (!started) {
      res.status(status).json({ error: message });
      return;
    }
    send('error', { error: message, status });
    res.end();
  };

  return { send, fail, signal: controller.signal, get started() { return started; } };
}
