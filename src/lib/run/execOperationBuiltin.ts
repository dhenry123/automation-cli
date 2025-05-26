/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { logDebugEvent } from "../log";
import { emitDataOnStream } from "./execOperation";
import type { HostsType, Operation } from "../types";
import { DuplexStream } from "../DuplexStream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { consoleLog } from "../../helpers/helperUI";
import { builtinSelector } from "./builtinOperations/selector";
import type { Spinner } from "../spinner";
import type { ReadLine } from "node:readline";

// Builtin operation
export const execOperationBuiltin = (
	host: HostsType,
	operation: Operation,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any,
	spinner: Spinner,
	rlHandler: ReadLine
) => {
	if (!operation.operation)
		throw new Error(
			"[ERROR SERIOUS] why there is not operation.operation at this level"
		);
	const stream = new DuplexStream();
	stream.on("data", (data) => {
		logDebugEvent(
			`Data received from DuplexStream stdout **${data
				.toString()
				.trim()}** (** marks for ending && starting string)`
		);
		// because spinner can't display muliple lines with \n
		for (const line of data.toString().trim().split("\n")) {
			emitDataOnStream(line.trim(), stream, false);
		}
	});

	stream.on("stderr", (data) => {
		logDebugEvent(
			`Data received from DuplexStream stderr ${data.toString().trim()}`
		);
		// because spinner can't display muliple lines with \n
		for (const line of data.toString().trim().split("\n")) {
			emitDataOnStream(line.trim(), stream, true);
		}
	});

	stream.on("ready", () => {
		consoleLog("[Internal] Builtin stream is Ready", "yellow");
		if (operation.operation)
			builtinSelector(
				operation.operation,
				{
					hostToPerform: host.toPerform,
					environment: operation.environment || {},
					inventoryFile: commanderOptions.inventoryFile,
					values: operation.values,
					nolog: operation.nolog,
					when: operation.when,
					limitHosts: operation.limitHosts,
				},
				stream,
				spinner,
				rlHandler
			);
	});

	stream.on("close", (code: Error | undefined | null) => {
		let message: Error | null = null;
		if (code)
			message = new Error(`builtin operation existing with code: ${code}`);
		stream.emit("endConn", message);
	});

	return stream as unknown as ChildProcessWithoutNullStreams;
};
