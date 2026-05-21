/** 事件总线 - 轻量发布/订阅，用于模块间解耦 */
export type EventMap = {
    start: [];
    complete: [];
    cancel: [];
    error: [message: string];
    progressUpdate: [bytesProcessed: number, totalBytes: number];
    statusChange: [status: 'idle' | 'done'];
};

export type EventName = keyof EventMap;

export class EventBus {
    private listeners = new Map<string, Set<(...args: any[]) => void>>();

    on<K extends EventName>(event: K, callback: (...args: EventMap[K]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    emit<K extends EventName>(event: K, ...args: EventMap[K]): void {
        this.listeners.get(event)?.forEach(cb => {
            try {
                cb(...args);
            } catch (err) {
                console.error(`EventBus error in ${event}:`, err);
            }
        });
    }
}