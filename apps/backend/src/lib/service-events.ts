import type { Response } from "express";

const clients = new Set<Response>();

function publish(event: string, data: Record<string, unknown> = {}): void {
  const message = `event: ${event}\ndata: ${JSON.stringify({ ...data, updatedAt: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    client.write(message);
    (client as Response & { flush?: () => void }).flush?.();
  }
}

export function addServiceDisplayClient(res: Response): () => void {
  clients.add(res);
  return () => clients.delete(res);
}

export function publishServiceCall(): void {
  publish("call");
  publish("update");
}

export function publishServiceQueueUpdate(): void {
  publish("update");
}

export function publishServiceQueueEntry(data: {
  queueId: number;
  sectorId: number;
}): void {
  publish("queue-entry", data);
  publish("update");
}
