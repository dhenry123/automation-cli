/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { spawn } from "child_process";
import { consoleErr } from "../../helpers/helperUI";
import { deleteTmpBashFile } from "../bash";
import { logDebugEvent } from "../log";
import { ShellDescription } from "../types";
import { emitDataOnStream } from "./execOperation";
import { checkIsLocalServerProtected } from "../checks";

export const runLocalSpawn = (
	spwanArgs: string[],
	productionEnv: NodeJS.ProcessEnv,
	shellDescription: ShellDescription
) => {
	// check is server protected
	checkIsLocalServerProtected();

	const runningSpawn = spawn("bash", spwanArgs, {
		env: productionEnv,
	});
	logDebugEvent(`runningSpawn: ${JSON.stringify(runningSpawn, null, 2)}`);
	runningSpawn.stdout.on("data", (data) => {
		logDebugEvent(
			`execOperationOnLocalTerminal Data received from Stream stdout **${data.toString()}** (** marks for ending && starting string)`
		);
		// because spinner can't display muliple lines with \n
		for (const line of data.toString().split("\n")) {
			emitDataOnStream(line, runningSpawn, false);
		}
	});

	runningSpawn.stderr.on("data", (data) => {
		// trim not applied in debug
		logDebugEvent(
			`execOperationOnLocalTerminal Data received from Stream stderr ${data.toString()}`
		);
		// because spinner can't display muliple lines with \n
		for (const line of data.toString().trim().split("\n")) {
			emitDataOnStream(line.trim(), runningSpawn, true);
		}
	});

	runningSpawn.on("error", (error: Error) => {
		consoleErr(
			`execOperationOnLocalTerminal received error: ${error.toString()}`
		);
		runningSpawn.emit("error", error);
	});

	runningSpawn.on("close", (code) => {
		// Deleting local tmp bash file
		if (shellDescription.tmpFile) {
			logDebugEvent(
				`execOperationOnLocalTerminal - Trying to delete ${shellDescription.tmpFile}`
			);
			deleteTmpBashFile(shellDescription.tmpFile);
		}
		let message: Error | null = null;
		if (code) message = new Error(`bash existing with code: ${code}`);
		runningSpawn.emit("endConn", message);
	});

	return runningSpawn;
};
