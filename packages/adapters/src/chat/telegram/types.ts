/**
 * Message context passed to onMessage handler
 */
export interface TelegramMessageContext {
  conversationId: string;
  message: string;
  userId: number | undefined;
}

/**
 * Receipt returned after a message is sent, containing Telegram's assigned message ID.
 * Used to enable deterministic acknowledgement tracking.
 */
export interface MessageReceipt {
  messageId: number;
  chatId: string;
  sentAt: Date;
}

/** Discriminated union of sprint event types for the Orion sprint track */
export type SprintEventType = 'planning_update' | 'task_emitted' | 'acknowledgement';

/** Payload for a Hermes Council sprint planning update */
export interface PlanningUpdatePayload {
  sprintId: string;
  title: string;
  body: string;
}

/** Payload for a task emission */
export interface TaskEmissionPayload {
  taskId: string;
  title: string;
  description?: string;
  assignee?: string;
}

/** Acknowledgement record linking an inbound ack to a previously sent event */
export interface AcknowledgementRecord {
  originalMessageId: number;
  acknowledgedAt: Date;
  acknowledgedBy: number | undefined;
}

/** Structured sprint event routed through the Archon execution spine */
export type SprintEvent =
  | { type: 'planning_update'; payload: PlanningUpdatePayload }
  | { type: 'task_emitted'; payload: TaskEmissionPayload }
  | { type: 'acknowledgement'; payload: AcknowledgementRecord };
