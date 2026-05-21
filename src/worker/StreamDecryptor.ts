import sodiumModule from 'libsodium-wrappers';
import type { StateAddress } from 'libsodium-wrappers';

export class StreamDecryptor {
    private state: StateAddress;

    private constructor(
        private sodium: typeof sodiumModule,
        state: StateAddress,
    ) {
        this.state = state;
    }

    static create(sodium: typeof sodiumModule, key: Uint8Array, header: Uint8Array): StreamDecryptor {
        const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key);
        return new StreamDecryptor(sodium, state);
    }

    /** 解密一个数据块，返回解密后的数据和 tag */
    pull(chunk: Uint8Array): { message: Uint8Array; tag: number } {
        return this.sodium.crypto_secretstream_xchacha20poly1305_pull(
            this.state, chunk, null
        );
    }

    /** 判断 tag 是否为 FINAL */
    isFinalTag(tag: number): boolean {
        return tag === this.sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL;
    }
}
