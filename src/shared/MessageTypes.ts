/** Worker → 主线程消息 */
export interface WorkerReadyMessage {
    type: 'READY';
    header: Uint8Array;
    key: Uint8Array;
}

export interface WorkerChunkResultMessage {
    type: 'CHUNK_RESULT';
    data: Uint8Array;
    isLast: boolean;
}

export interface WorkerHashResultMessage {
    type: 'HASH_RESULT';
    hash: Uint8Array;
}

export interface WorkerErrorMessage {
    type: 'ERROR';
    message: string;
}

export interface WorkerDecryptReadyMessage {
    type: 'DECRYPT_READY';
}

/** Worker 向主线程发送的消息联合类型 */
export type MainThreadMessage =
    | WorkerReadyMessage
    | WorkerChunkResultMessage
    | WorkerHashResultMessage
    | WorkerErrorMessage
    | WorkerDecryptReadyMessage
    | WorkerEncryptedUuidMessage
    | WorkerDecryptedUuidMessage;

/** 主线程 → Worker 消息 */
export interface InitEncryptMessage {
    type: 'INIT_ENCRYPT';
}

export interface EncryptUuidMessage {
    type: 'ENCRYPT_UUID';
    uuid: Uint8Array;
}

export interface EncryptChunkMessage {
    type: 'ENCRYPT_CHUNK';
    chunk: Uint8Array;
    isLast: boolean;
}

export interface InitDecryptMessage {
    type: 'INIT_DECRYPT';
    key: Uint8Array;
    header: Uint8Array;
}

export interface DecryptUuidMessage {
    type: 'DECRYPT_UUID';
    encryptedUuid: Uint8Array;
}

export interface DecryptChunkMessage {
    type: 'DECRYPT_CHUNK';
    chunk: Uint8Array;
    isLast: boolean;
}

export interface ComputeHashMessage {
    type: 'COMPUTE_HASH';
    chunk: Uint8Array;
    isLast: boolean;
}

/** 主线程向 Worker 发送的消息联合类型 */
export type WorkerMessage =
    | InitEncryptMessage
    | EncryptUuidMessage
    | EncryptChunkMessage
    | InitDecryptMessage
    | DecryptUuidMessage
    | DecryptChunkMessage
    | ComputeHashMessage;

/* Worker → 主线程：加密后的 UUID */
export interface WorkerEncryptedUuidMessage {
    type: 'ENCRYPTED_UUID';
    data: Uint8Array;
}

/* Worker → 主线程：解密后的 UUID */
export interface WorkerDecryptedUuidMessage {
    type: 'DECRYPTED_UUID';
    uuid: Uint8Array;
}