import { Platform } from "obsidian";

// Guard Node.js imports for desktop-only (Rule 36)
let spawn: typeof import("child_process").spawn;
let createInterface: typeof import("readline").createInterface;
type ChildProcess = import("child_process").ChildProcess;
type ReadlineInterface = import("readline").Interface;

if (Platform.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js child_process module only available on desktop, guarded by Platform.isDesktop
    const childProcessModule = require("child_process") as typeof import("child_process");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js readline module only available on desktop, guarded by Platform.isDesktop
    const readlineModule = require("readline") as typeof import("readline");
    spawn = childProcessModule.spawn;
    createInterface = readlineModule.createInterface;
}

export type EventHandler = (event: RpcEvent) => void;

// --- RPC Event Type Interfaces ---
// These define the structure of events received from Pi's RPC interface.

export interface RpcEvent {
    type: string;
    id?: string;
    success?: boolean;
    error?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface RpcResponse extends RpcEvent {
    type: "response";
    id: string;
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
}

export interface AgentStartEvent extends RpcEvent {
    type: "agent_start";
}

export interface AgentEndEvent extends RpcEvent {
    type: "agent_end";
    messages?: Array<Record<string, unknown>>;
}

export interface MessageStartEvent extends RpcEvent {
    type: "message_start";
    message?: Record<string, unknown>;
}

export interface MessageUpdateEvent extends RpcEvent {
    type: "message_update";
    assistantMessageEvent?: AssistantMessageEvent;
}

export interface MessageEndEvent extends RpcEvent {
    type: "message_end";
    message?: Record<string, unknown>;
}

export interface AssistantMessageEvent {
    type: "text_delta" | "thinking_delta" | "toolcall_start" | "toolcall_delta" | "toolcall_end" | "done" | "error" | "start" | "text_start" | "text_end" | "thinking_start" | "thinking_end";
    delta?: string;
    contentIndex?: number;
    partial?: Record<string, unknown>;
    toolCall?: Record<string, unknown>;
    reason?: string;
}

export interface ToolExecutionStartEvent extends RpcEvent {
    type: "tool_execution_start";
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
}

export interface ToolExecutionUpdateEvent extends RpcEvent {
    type: "tool_execution_update";
    toolCallId: string;
    toolName: string;
    partialResult?: Record<string, unknown>;
}

export interface ToolExecutionEndEvent extends RpcEvent {
    type: "tool_execution_end";
    toolCallId: string;
    toolName: string;
    result?: Record<string, unknown>;
    isError?: boolean;
}

export interface AutoCompactionEndEvent extends RpcEvent {
    type: "auto_compaction_end";
}

export interface RpcErrorEvent extends RpcEvent {
    type: "error";
    error: string;
}

// --- Pending Request Handler ---
// Stores resolve/reject callbacks for async request/response matching.

interface PendingRequest {
    resolve: (value: RpcEvent) => void;
    reject: (reason: Error) => void;
    timeoutId: number;
}

/**
 * Manages a connection to Pi's RPC interface.
 * Spawns `pi --mode rpc` and communicates via JSON lines over stdin/stdout.
 */
export class PiConnection {
    private piBinaryPath: string;
    private nodePath: string;
    private apiKeys: Record<string, string>;  // envVarName -> key
    private cwd: string;
    private extraArgs: string[];
    private timeout: number;
    private process: ChildProcess | null = null;
    private readline: ReadlineInterface | null = null;
    private handlers: EventHandler[] = [];
    private disconnectHandler: (() => void) | null = null;
    private connected = false;
    private requestId = 0;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private intentionallyDestroyed = false; // Flag to suppress error on intentional destroy

    constructor(
        piBinaryPath: string,
        cwd: string,
        extraArgs: string[] = [],
        nodePath: string = "",
        apiKeys: Record<string, string> = {},
        timeout: number = 60_000
    ) {
        this.piBinaryPath = piBinaryPath;
        this.cwd = cwd;
        this.extraArgs = extraArgs;
        this.nodePath = nodePath;
        this.apiKeys = apiKeys;
        this.timeout = timeout;
    }



    /**
     * Spawn the Pi process and set up JSON line parsing on stdout.
     */
    connect(): void {
        if (this.process) {
            this.destroy();
        }

        // Reset intentional destroy flag for new connection
        this.intentionallyDestroyed = false;

        if (!this.piBinaryPath || this.piBinaryPath.trim() === "") {
            throw new Error("Pi binary path is not configured. Please set the path in plugin settings.");
        }

        // GUI apps on macOS don't inherit shell PATH (nvm, etc.), so we need to
        // explicitly include node in PATH
        const currentPath = process.env.PATH || "";
        let enhancedPath = currentPath;

        // If user specified a node path, prepend it to PATH
        if (this.nodePath && this.nodePath.trim() !== "") {
            enhancedPath = `${this.nodePath}:${currentPath}`;
        } else {
            // Auto-detect: try common nvm/homebrew locations
            const nodePaths = [
                "/usr/local/bin",
                "/opt/homebrew/bin",
            ];
            enhancedPath = [...new Set([...nodePaths, ...currentPath.split(":")])].join(":");
        }

        // Build minimal env object - only PATH + user-configured API keys
        // Do NOT copy process.env wholesale (avoids identity fingerprinting warning)
        const env: Record<string, string> = { PATH: enhancedPath };

        // Pass API keys as env vars (from SecretStorage)
        for (const [envVarName, key] of Object.entries(this.apiKeys)) {
            if (key && key.trim()) {
                env[envVarName] = key;
            }
        }

        this.process = spawn(this.piBinaryPath, ["--mode", "rpc", ...this.extraArgs], {
            shell: true, // Needed for non-ASCII (e.g., Chinese) characters in binary path
            cwd: this.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env,
        });

        this.connected = true;

        // Buffer stderr to log on exit (helps diagnose fast crashes)
        const stderrBuffer: string[] = [];

        // Parse JSON lines from stdout
        if (this.process.stdout) {
            this.readline = createInterface({
                input: this.process.stdout,
                crlfDelay: Infinity,
            });

            this.readline.on("line", (line: string) => {
                const trimmed = line.trim();
                if (!trimmed) return;

                try {
                    const event = JSON.parse(trimmed) as RpcEvent;
                    this.dispatch(event);
                } catch {
                    // Non-JSON output — ignore (Pi may emit debug text)
                    console.warn("[Pi RPC] Non-JSON line from stdout:", trimmed);
                }
            });
        }

        // Log stderr for debugging and buffer it
        if (this.process.stderr) {
            this.process.stderr.on("data", (data: Buffer) => {
                const text = data.toString();
                stderrBuffer.push(text);
                console.warn("[Pi RPC] stderr:", text);
            });
        }

        // Handle process exit
        this.process.on("exit", (code: number | null, signal: string | null) => {
            // Suppress error if intentionally destroyed (e.g., reconnecting after API key change)
            if (this.intentionallyDestroyed) {
                this.connected = false;
                this.cleanup();
                return;
            }
            // Log exit info with any buffered stderr
            if (code !== 0) {
                console.warn("[Pi RPC] Process exited with code", code, "signal", signal);
                if (stderrBuffer.length > 0) {
                    console.warn("[Pi RPC] stderr output:", stderrBuffer.join(""));
                }
            }
            this.connected = false;
            this.dispatch({
                type: "error",
                error: `Pi process exited (code=${code}, signal=${signal})`,
            });
            this.cleanup();
        });

        this.process.on("error", (err: Error) => {
            this.connected = false;
            console.error("[Pi RPC] Process error:", err.message);
            if (stderrBuffer.length > 0) {
                console.error("[Pi RPC] stderr output:", stderrBuffer.join(""));
            }
            this.dispatch({
                type: "error",
                error: `Pi process error: ${err.message}`,
            });
            this.cleanup();
        });
    }


    /**
     * Send a command to Pi via stdin as a JSON line.
     * Automatically injects a request ID and returns a Promise that resolves
     * when Pi sends a matching response (type === "response" with same id).
     * Streaming events still go to onEvent handlers.
     */
    send(command: Record<string, unknown>): Promise<RpcEvent> {
        if (!this.process || !this.process.stdin || !this.connected) {
            throw new Error("Pi is not connected");
        }

        const id = `req-${this.requestId++}`;
        const line = JSON.stringify({ ...command, id }) + "\n";

        return new Promise((resolve, reject) => {
            // Create timeout first
            const timeoutId = window.setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request ${id} timed out after ${this.timeout / 1000}s`));
                }
            }, this.timeout);

            // Set the pending request BEFORE writing to stdin to avoid race condition
            // If response arrives between setting handlers and writing, it will still be handled
            this.pendingRequests.set(id, {
                resolve: (value) => {
                    window.clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (reason) => {
                    window.clearTimeout(timeoutId);
                    reject(reason);
                },
                timeoutId,
            });

            // Now write the request
            this.process!.stdin!.write(line);
        });
    }

    /**
     * Send a raw JSON line without request tracking.
     * Used for extension UI responses in RPC mode.
     */
    sendRaw(command: Record<string, unknown>): void {
        if (!this.process || !this.process.stdin || !this.connected) {
            throw new Error("Pi is not connected");
        }

        this.process.stdin.write(JSON.stringify(command) + "\n");
    }

    /**
     * Register a handler for events received from Pi.
     * Each JSON line parsed from stdout is dispatched to all handlers.
     */
    onEvent(handler: EventHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Remove a previously registered event handler.
     */
    offEvent(handler: EventHandler): void {
        const idx = this.handlers.indexOf(handler);
        if (idx !== -1) {
            this.handlers.splice(idx, 1);
        }
    }

    /**
     * Register a handler called when the Pi process disconnects unexpectedly.
     */
    onDisconnect(handler: () => void): void {
        this.disconnectHandler = handler;
    }

    /**
     * Kill the child process and clean up.
     */
    destroy(): void {
        this.intentionallyDestroyed = true; // Suppress error on exit
        this.disconnectHandler = null; // Don't fire on explicit destroy
        this.handlers = []; // Clear event handlers
        if (this.process) {
            this.process.kill();
        }
        this.cleanup();
    }

    /**
     * Check if the Pi process is alive.
     */
    isConnected(): boolean {
        return this.connected;
    }

    private dispatch(event: RpcEvent): void {
        // Suppress error events if intentionally destroyed
        if (event.type === "error" && this.intentionallyDestroyed) {
            return;
        }

        // Route responses to pending request Promises
        if (event.type === "response" && typeof event.id === "string") {
            const pending = this.pendingRequests.get(event.id);
            if (pending) {
                this.pendingRequests.delete(event.id);
                if (event.success === false) {
                    pending.reject(new Error(String(event.error || "Request failed")));
                } else {
                    pending.resolve(event);
                }
                return;
            }
        }

        // Non-response events go to streaming handlers
        for (const handler of this.handlers) {
            try {
                handler(event);
            } catch (err) {
                console.error("[Pi RPC] Handler error:", err);
            }
        }
    }

    private cleanup(): void {
        const wasConnected = this.connected;
        this.connected = false;
        if (this.readline) {
            this.readline.close();
            this.readline = null;
        }
        this.process = null;

        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
            window.clearTimeout(pending.timeoutId);
            pending.reject(new Error("Pi connection closed"));
        }
        this.pendingRequests.clear();

        if (wasConnected && this.disconnectHandler) {
            this.disconnectHandler();
        }
    }
}
