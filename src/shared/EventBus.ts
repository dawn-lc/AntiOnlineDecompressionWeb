/** 事件总线 - 轻量发布/订阅，用于模块间解耦 */
export type EventMap = {
    start: [];
    complete: [];
    cancel: [];
    error: [message: string];
    progressUpdate: [bytesProcessed: number, totalBytes: number];
    statusChange: [status: 'idle' | 'done'];
    showAlert: [message: string];
};

export type EventName = keyof EventMap;

export class EventBus {
    private listeners = new Map<EventName, Set<(...args: any[]) => void>>();

    on<K extends EventName>(event: K, callback: (...args: EventMap[K]) => void): void {
        const set = this.listeners.get(event);
        if (set) {
            set.add(callback);
        } else {
            this.listeners.set(event, new Set([callback]));
        }
    }

    emit<K extends EventName>(event: K, ...args: EventMap[K]): void {
        this.listeners.get(event)?.forEach(cb => {
            try {
                cb(...args);
            } catch (err) {
                console.error(`[EventBus] error in ${event}:`, err);
            }
        });
    }
}