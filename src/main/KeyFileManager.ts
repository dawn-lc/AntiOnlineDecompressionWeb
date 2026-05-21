import { HeaderSerializer } from '../shared/schemas/serializer';
import type { AODKHeader } from '../shared/schemas/aodk';

export class KeyFileManager {
    async parseAODKFile(file: File): Promise<AODKHeader> {
        const buffer = await file.arrayBuffer();
        const header = HeaderSerializer.deserializeAODK(buffer);
        if (!HeaderSerializer.validateAODKMagic(header.magic)) {
            throw new Error('无效的 AODK 文件：Magic 字节不匹配');
        }
        console.log(`[KeyFile] AODK 解析成功: ${file.name}`);
        return header;
    }
}