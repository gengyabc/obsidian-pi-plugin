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
export class PluginSettingTab {}
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