import sodiumModule from 'libsodium-wrappers';

let sodiumInstance: typeof sodiumModule | null = null;

export async function getSodium(): Promise<typeof sodiumModule> {
    if (sodiumInstance) return sodiumInstance;
    await sodiumModule.ready;
    sodiumInstance = sodiumModule;
    return sodiumInstance;
}