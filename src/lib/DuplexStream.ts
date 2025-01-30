/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/30/24
 */

import { Duplex } from "stream";
import { EventEmitter } from "events";

export class DuplexStream extends Duplex {
	private emitter: EventEmitter;

	constructor() {
		super({ objectMode: true });
		this.emitter = new EventEmitter();
		this.emit("ready");
	}

	// Override the on method with explicit event typing
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, listener: (data: any & any) => void): this {
		this.emitter.on(event, listener);
		return this;
	}

	// Add the emit method with a compatible signature
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	emit(event: string | symbol, ...args: any[]): boolean {
		return this.emitter.emit(event, ...args);
	}

	// Add the addListener method with explicit event typing
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	addListener(event: string, listener: (...args: any[]) => void): this {
		this.emitter.addListener(event, listener);
		return this;
	}
}
