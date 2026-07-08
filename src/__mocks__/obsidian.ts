// Mock obsidian module for testing
// Only provides stubs for types used in settings.ts and pi-config.ts

export const Platform = {
    isDesktop: true,
    isMobile: false,
    isMacOS: false,
    isWin: false,
    isLinux: false,
};

export class App {}
export class Plugin {
    app = new App();
    addSettingTab(): void {}
    addStatusBarItem(): HTMLElement { return {} as HTMLElement; }
    addCommand(): void {}
    addRibbonIcon(): HTMLElement { return {} as HTMLElement; }
    registerView(): void {}
    registerExtensions(): void {}
    loadData(): Promise<unknown> { return Promise.resolve(null); }
    saveData(): Promise<void> { return Promise.resolve(); }
}
export class PluginSettingTab {}
export class Modal {
    constructor(_app: App) {}
    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
    contentEl = { createEl: () => {}, empty: () => {} };
}
export class FuzzySuggestModal<T> {
    constructor(_app: App) {}
    open(): void {}
    close(): void {}
    getItems(): T[] { return []; }
    getItemText(_item: T): string { return ""; }
    onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}
export class WorkspaceLeaf {}
export class Component {}
export class ItemView extends Component {
    constructor(_leaf: WorkspaceLeaf) { super(); }
}
export class MarkdownRenderer {
    static render(): Promise<void> { return Promise.resolve(); }
}
export class Notice {
    constructor(_message?: string, _timeout?: number) {}
}
export class Setting {
    constructor(_containerEl: HTMLElement) {}
    setName(_name: string): this { return this; }
    setDesc(_desc: string): this { return this; }
    addText(_cb: (text: any) => void): this { return this; }
    addToggle(_cb: (toggle: any) => void): this { return this; }
    addDropdown(_cb: (dropdown: any) => void): this { return this; }
    addSlider(_cb: (slider: any) => void): this { return this; }
    addComponent(_cb: (el: any) => any): this { return this; }
    addExtraButton(_cb: (btn: any) => any): this { return this; }
    addButton(_cb: (btn: any) => any): this { return this; }
    setHeading(): this { return this; }
}
export class SecretComponent {
    constructor(_app: App, _el: any) {}
    setValue(_value: string): this { return this; }
    onChange(_cb: (value: string) => Promise<void>): this { return this; }
}