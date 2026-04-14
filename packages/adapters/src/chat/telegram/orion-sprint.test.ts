/**
 * Unit tests for OrionSprintAdapter
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Mock } from 'bun:test';

// Mock logger to suppress noisy output during tests
const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
  child: mock(function (this: unknown) {
    return this;
  }),
  bindings: mock(() => ({ module: 'test' })),
  isLevelEnabled: mock(() => true),
  level: 'info',
};
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

import { OrionSprintAdapter } from './orion-sprint';
import type { PlanningUpdatePayload, TaskEmissionPayload, AcknowledgementRecord } from './types';

/** Build a mock sendMessage that resolves with a Message stub */
function makeMockSendMessage(messageId: number): Mock<() => Promise<{ message_id: number }>> {
  return mock(() => Promise.resolve({ message_id: messageId }));
}

describe('OrionSprintAdapter', () => {
  let adapter: OrionSprintAdapter;
  let mockSendMessage: Mock<() => Promise<{ message_id: number }>>;

  beforeEach(() => {
    adapter = new OrionSprintAdapter('fake-token-for-testing');
    mockSendMessage = makeMockSendMessage(42);
    (
      adapter.getBot().telegram as unknown as {
        sendMessage: Mock<() => Promise<{ message_id: number }>>;
      }
    ).sendMessage = mockSendMessage;
  });

  describe('sendMessageWithReceipt', () => {
    test('should return a receipt with the Telegram message_id', async () => {
      mockSendMessage = makeMockSendMessage(99);
      (
        adapter.getBot().telegram as unknown as {
          sendMessage: Mock<() => Promise<{ message_id: number }>>;
        }
      ).sendMessage = mockSendMessage;

      const receipt = await adapter.sendMessageWithReceipt('12345', 'hello');

      expect(receipt.messageId).toBe(99);
      expect(receipt.chatId).toBe('12345');
      expect(receipt.sentAt).toBeInstanceOf(Date);
    });

    test('should call telegram.sendMessage with parsed chat ID', async () => {
      await adapter.sendMessageWithReceipt('77777', 'test message');

      expect(mockSendMessage).toHaveBeenCalledWith(77777, 'test message');
    });
  });

  describe('sendEvent', () => {
    test('should return a receipt and store it in pendingAcks', async () => {
      const update: PlanningUpdatePayload = {
        sprintId: 'S1',
        title: 'Sprint kickoff',
        body: 'Focus on auth module',
      };

      const receipt = await adapter.sendEvent('12345', {
        type: 'planning_update',
        payload: update,
      });

      expect(receipt.messageId).toBe(42);
      expect(adapter.getPendingAcks().has(42)).toBe(true);
    });

    test('should format planning_update event text', async () => {
      const update: PlanningUpdatePayload = {
        sprintId: 'S2',
        title: 'Hermes Council review',
        body: 'Review completed items',
      };

      await adapter.sendEvent('12345', { type: 'planning_update', payload: update });

      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('Sprint Planning Update');
      expect(text).toContain('S2');
      expect(text).toContain('Hermes Council review');
      expect(text).toContain('Review completed items');
    });

    test('should format task_emitted event text with all fields', async () => {
      const task: TaskEmissionPayload = {
        taskId: 'T-42',
        title: 'Implement auth',
        description: 'OAuth2 flow',
        assignee: 'alice',
      };

      await adapter.sendEvent('12345', { type: 'task_emitted', payload: task });

      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('T-42');
      expect(text).toContain('Implement auth');
      expect(text).toContain('OAuth2 flow');
      expect(text).toContain('alice');
    });

    test('should format task_emitted event without optional fields', async () => {
      const task: TaskEmissionPayload = { taskId: 'T-1', title: 'Minimal task' };

      await adapter.sendEvent('12345', { type: 'task_emitted', payload: task });

      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('T-1');
      expect(text).toContain('Minimal task');
      expect(text).not.toContain('Assignee');
    });

    test('should format acknowledgement event text', async () => {
      const ack: AcknowledgementRecord = {
        originalMessageId: 77,
        acknowledgedAt: new Date(),
        acknowledgedBy: 123,
      };

      await adapter.sendEvent('12345', { type: 'acknowledgement', payload: ack });

      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('Acknowledged');
      expect(text).toContain('77');
    });
  });

  describe('emitTask', () => {
    test('should call sendEvent with task_emitted type and return receipt', async () => {
      const task: TaskEmissionPayload = { taskId: 'T-5', title: 'Deploy service' };

      const receipt = await adapter.emitTask('12345', task);

      expect(receipt.messageId).toBe(42);
      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('T-5');
    });
  });

  describe('sendPlanningUpdate', () => {
    test('should call sendEvent with planning_update type and return receipt', async () => {
      const update: PlanningUpdatePayload = {
        sprintId: 'S3',
        title: 'Mid-sprint sync',
        body: 'Check blockers',
      };

      const receipt = await adapter.sendPlanningUpdate('12345', update);

      expect(receipt.messageId).toBe(42);
      const [, text] = mockSendMessage.mock.calls[0] as [number, string];
      expect(text).toContain('S3');
      expect(text).toContain('Mid-sprint sync');
    });
  });

  describe('acknowledge', () => {
    test('should remove receipt from pendingAcks', async () => {
      await adapter.sendEvent('12345', {
        type: 'planning_update',
        payload: { sprintId: 'S1', title: 'T', body: 'B' },
      });
      expect(adapter.getPendingAcks().has(42)).toBe(true);

      adapter.acknowledge(42, 999);

      expect(adapter.getPendingAcks().has(42)).toBe(false);
    });

    test('should return an AcknowledgementRecord with correct fields', () => {
      const record = adapter.acknowledge(77, 456);

      expect(record.originalMessageId).toBe(77);
      expect(record.acknowledgedBy).toBe(456);
      expect(record.acknowledgedAt).toBeInstanceOf(Date);
    });

    test('should fire the registered ack handler', () => {
      const handler = mock((_r: AcknowledgementRecord) => undefined);
      adapter.onAcknowledgement(handler);

      adapter.acknowledge(10, 111);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].originalMessageId).toBe(10);
    });

    test('should handle acknowledge with undefined acknowledgedBy', () => {
      const record = adapter.acknowledge(55, undefined);

      expect(record.acknowledgedBy).toBeUndefined();
    });

    test('should not throw when no ack handler is registered', () => {
      expect(() => adapter.acknowledge(1, 1)).not.toThrow();
    });
  });

  describe('getPendingAcks', () => {
    test('should return empty map initially', () => {
      expect(adapter.getPendingAcks().size).toBe(0);
    });

    test('should accumulate multiple pending receipts', async () => {
      let counter = 100;
      mockSendMessage = mock(() => Promise.resolve({ message_id: ++counter }));
      (
        adapter.getBot().telegram as unknown as {
          sendMessage: Mock<() => Promise<{ message_id: number }>>;
        }
      ).sendMessage = mockSendMessage;

      await adapter.emitTask('12345', { taskId: 'T-A', title: 'Task A' });
      await adapter.emitTask('12345', { taskId: 'T-B', title: 'Task B' });

      expect(adapter.getPendingAcks().size).toBe(2);
    });
  });

  describe('getPlatformType', () => {
    test('should inherit telegram platform type from base adapter', () => {
      expect(adapter.getPlatformType()).toBe('telegram');
    });
  });
});
