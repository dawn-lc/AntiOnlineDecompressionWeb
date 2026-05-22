/** 全局类型声明 */

interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: ArrayBuffer | Uint8Array): Promise<void>;
    close(): Promise<void>;
}

interface Window {
    showSaveFilePicker?(options: { suggestedName: string }): Promise<FileSystemFileHandle>;
    showDirectoryPicker?(options: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}
