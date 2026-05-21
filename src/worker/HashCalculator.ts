import sodiumModule from 'libsodium-wrappers';
import type { StateAddress } from 'libsodium-wrappers';

export class HashCalculator {
    private state: StateAddress;

    private constructor(
        private sodium: typeof sodiumModule,
        state: StateAddress,
    ) {
        this.state = state;
    }

    static create(sodium: typeof sodiumModule): HashCalculator {
        const state = sodium.crypto_generichash_init(
            sodium.crypto_generichash_KEYBYTES_MIN > 0
                ? new Uint8Array(sodium.crypto_generichash_KEYBYTES_MIN)
                : null,
            sodium.crypto_generichash_BYTES
        );
        return new HashCalculator(sodium, state);
    }

    /** 增量更新哈希 */
    update(chunk: Uint8Array): void {
        this.sodium.crypto_generichash_update(this.state, chunk);
    }

    /** 完成哈希计算，返回 32 字节哈希值 */
    final(): Uint8Array {
        return this.sodium.crypto_generichash_final(
            this.state,
            this.sodium.crypto_generichash_BYTES
        );
    }
}