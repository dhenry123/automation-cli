/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import process from "process";
import rdl from "readline";

export class Spinner {
	text: string;
	interval: number;
	process: NodeJS.Timeout | null;
	rowNumber: number;
	screen: boolean;
	inPause: number;

	constructor(text: string, interval?: number) {
		this.text = text || "";
		this.interval = interval || 100;
		this.process = null;
		this.rowNumber = 0;
		this.inPause = 0;
		if (!process.stdout.clearScreenDown) {
			this.screen = false;
		} else {
			this.screen = true;
		}
	}

	setText(text: string) {
		if (!this.screen) return;
		if (text.match(/^JSONOUTPUT:/)) return;
		const maxToDisplay = process.stdout.columns - 6;
		if (text.length > maxToDisplay) {
			this.text = `${text.substring(0, maxToDisplay)}...`;
		} else {
			this.text = text;
		}
	}
	stop() {
		if (!this.screen) return;
		process.stdout.write("\x1B[?25h");
		if (this.process) {
			clearInterval(this.process);
			this.process = null;
			setTimeout(() => {
				rdl.clearLine(process.stdout, 0);
			}, 50);
		}
	}
	pauseSpin() {
		if (!this.inPause) {
			this.inPause = 1;
			if (this.process) {
				clearInterval(this.process);
				this.process = null;
			}
		} else {
			this.inPause = 0;
			this.spin(this.rowNumber);
		}
	}
	spin(rowNumber: number) {
		if (!this.screen) return;
		this.rowNumber = rowNumber;
		process.stdout.write("\x1B[?25l"); // hide cursor
		const spinners = ["-", "\\", "|", "/"];
		let index = 0;

		this.process = setInterval(() => {
			let line = spinners[index];
			if (line === undefined) {
				index = 0;
				line = spinners[index];
			}
			if (process.stdout.clearLine) process.stdout.clearLine(0);
			process.stdout.write(`${line} ${this.text}`);
			rdl.cursorTo(process.stdout, 0, rowNumber);
			index = index >= spinners.length ? 0 : index + 1;
		}, this.interval);
	}
}
