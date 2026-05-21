import { EventBus } from '../shared/EventBus';
import { formatBytes } from '../shared/formatBytes';
import { requestPopupPermission } from './SaveHelper';

/** 从 DOM 中取元素的简写 */
const getById = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class UI {
    /** 所有 DOM 元素引用，避免反复查询 */
    private el = {
        progressBar: getById<HTMLDivElement>('progressBarFill'),
        progressText: getById<HTMLSpanElement>('progressText'),
        encryptBtn: getById<HTMLButtonElement>('encryptBtn'),
        decryptBtn: getById<HTMLButtonElement>('decryptBtn'),

        encryptDrop: getById<HTMLDivElement>('encryptDrop'),
        encryptFileInfo: getById<HTMLDivElement>('encryptFileInfo'),
        encryptFileName: getById<HTMLSpanElement>('encryptFileName'),
        encryptFileSize: getById<HTMLSpanElement>('encryptFileSize'),
        encryptClearBtn: getById<HTMLButtonElement>('encryptClearBtn'),
        decryptAodkRow: getById<HTMLDivElement>('decryptAodkRow'),
        decryptAodfRow: getById<HTMLDivElement>('decryptAodfRow'),
        decryptAodkName: getById<HTMLSpanElement>('decryptAodkName'),
        decryptAodfName: getById<HTMLSpanElement>('decryptAodfName'),
        progressSection: getById<HTMLDivElement>('progressSection'),
        encryptTab: document.querySelector<HTMLButtonElement>('[data-tab="encrypt"]')!,
        decryptTab: document.querySelector<HTMLButtonElement>('[data-tab="decrypt"]')!,
    } as const;

    /** 各按钮的原始文本，用于操作结束后恢复 */
    private static BTN_LABELS = {
        encrypt: '🔒 加密文件',
        decrypt: '🔓 解密文件',
    };
    private static CANCEL_LABEL = '✕ 取消';

    private selectedFile: File | null = null;
    private selectedAodk: File | null = null;
    private selectedAodf: File | null = null;
    private isBusy = false;

    constructor(private eventBus: EventBus) {
        this.bindEvents();
        this.initUI();
    }

    /* ================ 初始化 ================ */

    private initUI(): void {
        this.el.encryptTab.addEventListener('click', () => {
            if (this.isBusy) return;
            location.hash = 'encrypt';
            this.resetProgress();
        });
        this.el.decryptTab.addEventListener('click', () => {
            if (this.isBusy) return;
            location.hash = 'decrypt';
            this.resetProgress();
        });
        this.setupEncryptUpload();
        this.setupDecryptInput('aodk', (f) => { this.selectedAodk = f; });
        this.setupDecryptInput('aodf', (f) => { this.selectedAodf = f; });
    }

    /** 切换面板时重置进度区 */
    private resetProgress(): void {
        this.el.progressSection.classList.remove('visible');
        this.el.progressBar.style.width = '0%';
        this.el.progressText.textContent = '';
    }

    /** 创建隐藏的 file input 并加在指定元素之后 */
    private createFileInput(id: string, afterEl: HTMLElement): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.id = id;
        afterEl.parentNode?.insertBefore(input, afterEl.nextSibling);
        return input;
    }

    /** 配置加密拖拽/文件选择 */
    private setupEncryptUpload(): void {
        const input = this.createFileInput('fileInput', this.el.encryptDrop);

        this.el.encryptDrop.addEventListener('click', () => input.click());
        this.el.encryptDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.el.encryptDrop.classList.add('drag-over');
        });
        this.el.encryptDrop.addEventListener('dragleave', () => {
            this.el.encryptDrop.classList.remove('drag-over');
        });
        this.el.encryptDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            this.el.encryptDrop.classList.remove('drag-over');
            if (e.dataTransfer?.files.length) this.setEncryptFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files?.length) this.setEncryptFile(input.files[0]);
        });
        this.el.encryptClearBtn.addEventListener('click', () => {
            this.clearEncryptFile();
            input.value = '';
        });
    }

    /** 配置解密文件选择行（aodk / aodf） */
    private setupDecryptInput(
        type: 'aodk' | 'aodf',
        onSelect: (file: File) => void,
    ): void {
        const row = type === 'aodk' ? this.el.decryptAodkRow : this.el.decryptAodfRow;
        const input = this.createFileInput(`${type}Input`, row);
        row.addEventListener('click', () => input.click());
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            onSelect(file);
            const nameEl = type === 'aodk' ? this.el.decryptAodkName : this.el.decryptAodfName;
            nameEl.textContent = file.name;
            nameEl.classList.remove('empty');
            row.classList.add('has-file');
            // 由 onStart/onCancel 统一管理按钮状态
            if (!this.isBusy) {
                this.el.decryptBtn.disabled = !(this.selectedAodk && this.selectedAodf);
            }
        });
    }

    /* ================ 文件状态 ================ */

    private setEncryptFile(file: File): void {
        this.selectedFile = file;
        this.el.encryptFileName.textContent = file.name;
        this.el.encryptFileSize.textContent = formatBytes(file.size);
        this.el.encryptFileInfo.classList.add('visible');
        this.el.encryptDrop.style.display = 'none';
        this.el.encryptBtn.disabled = false;
    }

    private clearEncryptFile(): void {
        this.selectedFile = null;
        this.el.encryptFileInfo.classList.remove('visible');
        this.el.encryptDrop.style.display = '';
        this.el.encryptBtn.disabled = true;
    }

    private bindEvents(): void {
        this.eventBus.on('error', (message: string) => console.error('[错误]', message));
        this.eventBus.on('progressUpdate', (bytes: number, total: number) => this.updateProgress(bytes, total));
        this.eventBus.on('complete', () => this.onComplete());
        this.eventBus.on('start', () => this.onStart());
        this.eventBus.on('cancel', () => this.onCancel());
        this.eventBus.on('statusChange', (state: string) => {
            if (state === 'idle') {
                this.resetEncryptState();
                this.resetDecryptState();
            }
        });
    }



    updateProgress(bytes: number, total: number): void {
        const percent = total > 0 ? Math.round((bytes / total) * 100) : 0;
        this.el.progressBar.style.width = `${percent}%`;
        this.el.progressText.textContent = `${formatBytes(bytes)} / ${formatBytes(total)} (${percent}%)`;
    }

    onComplete(): void {
        this.isBusy = false;
        this.restoreButtons();
        this.el.progressSection.classList.remove('visible');
        this.el.progressBar.style.width = '0%';
        this.el.progressText.textContent = '';
        this.resetEncryptState();
        this.resetDecryptState();
    }

    private resetEncryptState(): void {
        this.selectedFile = null;
        this.el.encryptFileInfo.classList.remove('visible');
        this.el.encryptDrop.style.display = '';
        this.el.encryptBtn.disabled = true;
        getById<HTMLInputElement>('fileInput').value = '';
    }

    private resetDecryptState(): void {
        this.selectedAodk = null;
        this.selectedAodf = null;
        this.resetDecryptRow('aodk');
        this.resetDecryptRow('aodf');
        this.el.decryptBtn.disabled = true;
        getById<HTMLInputElement>('aodkInput').value = '';
        getById<HTMLInputElement>('aodfInput').value = '';
    }

    /** 重置单行解密文件选择器的状态 */
    private resetDecryptRow(type: 'aodk' | 'aodf'): void {
        const row = type === 'aodk' ? this.el.decryptAodkRow : this.el.decryptAodfRow;
        const nameEl = type === 'aodk' ? this.el.decryptAodkName : this.el.decryptAodfName;
        nameEl.textContent = `点击选择${type === 'aodk' ? '密钥' : '加密'}文件`;
        nameEl.classList.add('empty');
        row.classList.remove('has-file');
    }

    onStart(): void {
        this.isBusy = true;
        // 判断哪个面板当前激活，将其按钮切换为取消按钮
        const isEncrypt = (location.hash.slice(1) || 'encrypt').toLowerCase() !== 'decrypt';
        const btn = isEncrypt ? this.el.encryptBtn : this.el.decryptBtn;
        btn.textContent = UI.CANCEL_LABEL;
        btn.className = 'btn btn-danger';
        btn.disabled = false;
        // 禁用另一面板的按钮（防止切换）
        (isEncrypt ? this.el.decryptBtn : this.el.encryptBtn).disabled = true;
        this.el.progressSection.classList.add('visible');
        this.el.progressBar.style.width = '0%';
        this.el.progressText.textContent = '';
    }

    onCancel(): void {
        this.isBusy = false;
        console.log('操作已取消');
        this.restoreButtons();
        this.el.progressSection.classList.remove('visible');
        this.el.progressBar.style.width = '0%';
        this.el.progressText.textContent = '';
        this.resetEncryptState();
        this.resetDecryptState();
    }

    /** 恢复两个按钮到初始状态 */
    private restoreButtons(): void {
        this.el.encryptBtn.textContent = UI.BTN_LABELS.encrypt;
        this.el.decryptBtn.textContent = UI.BTN_LABELS.decrypt;
        this.el.encryptBtn.className = 'btn btn-primary';
        this.el.decryptBtn.className = 'btn btn-primary';
        this.el.encryptBtn.disabled = true;
        this.el.decryptBtn.disabled = true;
    }

    onEncryptClick(callback: (file: File) => void): void {
        this.el.encryptBtn.addEventListener('click', () => {
            requestPopupPermission();
            if (this.isBusy) { this.eventBus.emit('cancel'); return; }
            if (this.selectedFile) callback(this.selectedFile);
            else console.error('请先选择要加密的文件');
        });
    }

    onDecryptClick(callback: (aodkFile: File, aodfFile: File) => void): void {
        this.el.decryptBtn.addEventListener('click', () => {
            requestPopupPermission();
            if (this.isBusy) { this.eventBus.emit('cancel'); return; }
            if (this.selectedAodk && this.selectedAodf) callback(this.selectedAodk, this.selectedAodf);
            else console.error('请同时选择密钥文件和加密文件');
        });
    }

}