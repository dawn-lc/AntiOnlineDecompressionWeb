import sodiumModule from 'libsodium-wrappers';
import type { StateAddress } from 'libsodium-wrappers';

export class StreamEncryptor {
    private state: StateAddress;
    private header: Uint8Array;
    private _key: Uint8Array;

    private constructor(
        private sodium: typeof sodiumModule,
        state: StateAddress,
        header: Uint8Array,
        key: Uint8Array,
    ) {
        this.state = state;
        this.header = header;
        this._key = key;
    }

    static async create(sodium: typeof sodiumModule): Promise<StreamEncryptor> {
        const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
        const res = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
        return new StreamEncryptor(sodium, res.state, res.header, key);
    }

    /** 获取 stream header（用于构建 AODK 密钥文件） */
    getHeader(): Uint8Array {
        return this.header;
    }

    /** 获取加密密钥 */
    get key(): Uint8Array {
        return this._key;
    }

    /** 加密一个数据块，isLastChunk 标记最后一块 */
    push(chunk: Uint8Array, isLastChunk: boolean): Uint8Array {
        const tag = isLastChunk
            ? this.sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
            : this.sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
        return this.sodium.crypto_secretstream_xchacha20poly1305_push(
            this.state, chunk, null, tag
        );
    }
}
