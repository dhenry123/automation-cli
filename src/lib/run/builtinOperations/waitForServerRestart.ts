/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { DuplexStream } from "../../DuplexStream";
import { checkConnection } from "../../../helpers/HelperNetworkV4";
import { emitDataOnStream } from "../execOperation";
import { isMaxTimeoutReached, sleep } from "../../system";
import {
	BuiltinValuesToObject,
	ExecBuiltinOperationParameters,
} from "../../types";

import { logDebugEvent } from "../../log";
import { builtinGetParameterValues } from "../../../helpers/helperOperations";

/**
 * Wait service is offline
 * Wait service is online
 * timeout option
 *
 * To test this method without waiting for reboot, in the second step replace host with a real ip not reachable
 * @todo include a better process to detect when ssh service is really up
 */
export const builtinWaitForServerRestart = async (
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream,
	timeoutConnect: number = 3000
) => {
	const execParameters: BuiltinValuesToObject = builtinGetParameterValues(
		parameters.hostToPerform,
		parameters.values
	);

	logDebugEvent(
		`builtinWaitForServerRestart, execParameters: ${JSON.stringify(
			execParameters,
			null,
			4
		)}`,
		false
	);

	let startingWait = new Date().valueOf();

	emitDataOnStream(
		`Waiting for the service: ${execParameters.host}:${execParameters.port} to go offline (max: ${execParameters.timeoutServerOffline} sec)`,
		stream,
		false
	);

	const periodWaitOffline = new Date().valueOf();
	// wait until the service can not be reached ( timeout - service is rebooting...)
	while (true) {
		const connectionTest = await checkConnection(
			execParameters.host,
			execParameters.port,
			timeoutConnect
		)
			.then((result) => {
				logDebugEvent(
					`builtinWaitForServerRestart::checkConnection - result: ${result}`
				);
				return result;
			})
			.catch((error) => {
				logDebugEvent(
					`builtinWaitForServerRestart::checkConnection - result: ${(
						error as Error
					).toString()}`
				);
				return error;
			});
		// expected Error
		if (connectionTest) {
			emitDataOnStream(
				`Step 1: The service: ${execParameters.host}:${
					execParameters.port
				} is offline [Waiting time: ${
					new Date().valueOf() - periodWaitOffline
				} ms]`,
				stream,
				false
			);
			break;
		}
		await sleep(50);

		if (
			isMaxTimeoutReached(startingWait, execParameters.timeoutServerOffline)
		) {
			stream.emit(
				"close",
				`Timeout has been reached: Server: ${execParameters.host} is always online (${execParameters.timeoutServerOffline} sec)`
			);
			return;
		}
	}
	// Wait until the service is reachable
	// Reinit start process time
	emitDataOnStream(
		`Waiting for the service: ${execParameters.host}:${execParameters.port} to go online (max: ${execParameters.timeoutServerOnline} sec)`,
		stream,
		false
	);
	startingWait = new Date().valueOf();
	let offlinePeriod = 0;
	while (true) {
		logDebugEvent(
			`Trying to connect to service: ${execParameters.host}:${execParameters.host}`
		);
		const connectionTest: { code: number; output: string } =
			await checkConnection(
				execParameters.host,
				execParameters.port,
				timeoutConnect
			)
				.then((result) => {
					return result;
				})
				.catch((error) => {
					return error;
				});
		// Server is up: expected null
		if (!connectionTest) {
			offlinePeriod = new Date().valueOf() - startingWait;
			emitDataOnStream(
				`Step 2: The service: ${execParameters.host}:${execParameters.port} is online [Waiting time: ${offlinePeriod} ms]`,
				stream,
				false
			);
			break;
		}
		await sleep(50);
		if (isMaxTimeoutReached(startingWait, execParameters.timeoutServerOnline)) {
			stream.emit(
				"close",
				new Error(`Timeout has been reached: Server not reachable (offline)`)
			);
			return;
		}
	}
	emitDataOnStream(
		`[INFO] The service: ${execParameters.host}:${execParameters.port} is online and ready to accept connections after a disconnection period: ${offlinePeriod} ms`,
		stream,
		false
	);
	stream.emit("close");
	return;
};
