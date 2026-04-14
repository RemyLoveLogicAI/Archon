/**
 * Orion Sprint Adapter — deterministic Telegram adapter for the Orion sprint track.
 *
 * Routes Hermes Council planning updates through Archon as the execution spine,
 * exposing a clean event/receipt interface for sprint planning, task emission,
 * and deterministic acknowledgement flows.
 *
 * Structured for reuse as proprietary infrastructure (IP-first).
 */
import { createLogger } from '@archon/paths';
import { TelegramAdapter } from './adapter';
import type {
  MessageReceipt,
  PlanningUpdatePayload,
  TaskEmissionPayload,
  SprintEvent,
  AcknowledgementRecord,
} from './types';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('adapter.telegram.orion');
  return cachedLog;
}

/**
 * OrionSprintAdapter — extends TelegramAdapter with deterministic sprint tracking.
 *
 * Key capabilities:
 * - `sendEvent()` returns a MessageReceipt for every outbound sprint event
 * - Tracks in-flight receipts keyed by Telegram message ID for ack correlation
 * - `emitTask()` and `sendPlanningUpdate()` are structured convenience wrappers
 * - `acknowledge()` closes the loop on a tracked receipt and fires the ack handler
 */
export class OrionSprintAdapter extends TelegramAdapter {
  /** Receipts awaiting acknowledgement, keyed by Telegram message ID */
  private readonly pendingAcks = new Map<number, MessageReceipt>();

  /** Handler invoked whenever an inbound acknowledgement is recorded */
  private ackHandler: ((record: AcknowledgementRecord) => void) | null = null;

  constructor(token: string, mode: 'stream' | 'batch' = 'stream') {
    super(token, mode);
    getLog().info('orion.adapter_initialized');
  }

  /**
   * Send a structured sprint event to a Telegram chat.
   *
   * Returns a MessageReceipt containing the Telegram-assigned message ID.
   * The receipt is stored in `pendingAcks` until `acknowledge()` is called,
   * enabling deterministic correlation of downstream acknowledgements.
   */
  async sendEvent(chatId: string, event: SprintEvent): Promise<MessageReceipt> {
    const text = this.formatEvent(event);
    const receipt = await this.sendMessageWithReceipt(chatId, text);
    this.pendingAcks.set(receipt.messageId, receipt);
    getLog().info(
      { chatId, eventType: event.type, messageId: receipt.messageId },
      'orion.event_sent'
    );
    return receipt;
  }

  /**
   * Emit a task to a Telegram chat.
   * Convenience wrapper around sendEvent() for TaskEmissionPayload.
   */
  async emitTask(chatId: string, task: TaskEmissionPayload): Promise<MessageReceipt> {
    return this.sendEvent(chatId, { type: 'task_emitted', payload: task });
  }

  /**
   * Send a Hermes Council sprint planning update.
   * Convenience wrapper around sendEvent() for PlanningUpdatePayload.
   */
  async sendPlanningUpdate(chatId: string, update: PlanningUpdatePayload): Promise<MessageReceipt> {
    return this.sendEvent(chatId, { type: 'planning_update', payload: update });
  }

  /**
   * Register a handler to be called whenever an acknowledgement is recorded.
   */
  onAcknowledgement(handler: (record: AcknowledgementRecord) => void): void {
    this.ackHandler = handler;
  }

  /**
   * Record an acknowledgement for a previously sent event.
   *
   * Removes the receipt from pendingAcks, fires the registered ack handler,
   * and returns the AcknowledgementRecord for the caller to inspect or persist.
   *
   * Can be called directly (e.g. from a reply hook) or injected externally.
   */
  acknowledge(
    originalMessageId: number,
    acknowledgedBy: number | undefined
  ): AcknowledgementRecord {
    const record: AcknowledgementRecord = {
      originalMessageId,
      acknowledgedAt: new Date(),
      acknowledgedBy,
    };
    this.pendingAcks.delete(originalMessageId);
    getLog().info({ originalMessageId, acknowledgedBy }, 'orion.ack_received');
    if (this.ackHandler) {
      this.ackHandler(record);
    }
    return record;
  }

  /**
   * Return a snapshot of receipts that have been sent but not yet acknowledged.
   */
  getPendingAcks(): ReadonlyMap<number, MessageReceipt> {
    return this.pendingAcks;
  }

  /**
   * Send a message and return a MessageReceipt with the Telegram message ID.
   *
   * Unlike sendMessage() (which returns void), this captures the message_id
   * from Telegram's response to enable deterministic acknowledgement tracking.
   */
  async sendMessageWithReceipt(chatId: string, text: string): Promise<MessageReceipt> {
    const id = parseInt(chatId);
    const sentAt = new Date();
    const result = await this.getBot().telegram.sendMessage(id, text);
    const receipt: MessageReceipt = {
      messageId: result.message_id,
      chatId,
      sentAt,
    };
    getLog().debug({ chatId, messageId: receipt.messageId }, 'orion.message_sent_with_receipt');
    return receipt;
  }

  /**
   * Format a SprintEvent into a human-readable Telegram message (plain text).
   */
  private formatEvent(event: SprintEvent): string {
    switch (event.type) {
      case 'planning_update': {
        const p = event.payload as PlanningUpdatePayload;
        return `[Sprint Planning Update] Sprint ${p.sprintId}: ${p.title}\n\n${p.body}`;
      }
      case 'task_emitted': {
        const t = event.payload as TaskEmissionPayload;
        const parts: string[] = [`[Task ${t.taskId}] ${t.title}`];
        if (t.description) parts.push(t.description);
        if (t.assignee) parts.push(`Assignee: ${t.assignee}`);
        return parts.join('\n');
      }
      case 'acknowledgement': {
        const a = event.payload as AcknowledgementRecord;
        return `[Acknowledged] message ${a.originalMessageId}`;
      }
    }
  }
}
