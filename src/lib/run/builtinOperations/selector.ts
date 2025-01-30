/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { ExecBuiltinOperationParameters } from "../../types";
import { builtinWaitForServerRestart } from "./waitForServerRestart";
import { DuplexStream } from "../../DuplexStream";
import { emitDataOnStream } from "../execOperation";
import {
	isCidrNetwork,
	isPrivateCidrNetwork,
} from "../../../helpers/HelperNetworkV4";
import { logDebugEvent } from "../../log";
import { builtinUpdateInventory } from "./updateInventory";
import { builtinConfirm } from "./confirm";
import { Spinner } from "../../spinner";
import { ReadLine } from "readline";

export const builtinSelector = async (
	operationName: string,
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream,
	spinner: Spinner,
	rlHandler: ReadLine
) => {
	// console.debug("spawnBuiltin::debug", parameters, operationName);
	logDebugEvent(
		`builtinSelector asked: operationName: ${operationName}, parameters: ${JSON.stringify(
			parameters,
			null,
			4
		)}`
	);

	switch (operationName) {
		case "#waitForServerRestart":
			await builtinWaitForServerRestart(parameters, stream);
			return;
		case "#isPrivateCidrNetwork":
			await isPrivateCidrNetwork(parameters, stream);
			return;
		case "#isCidrNetwork":
			await isCidrNetwork(parameters, stream);
			return;
		case "#updateInventory":
			await builtinUpdateInventory(parameters, stream);
			return;
		case "#confirm":
			if (spinner) spinner.pauseSpin();
			await builtinConfirm(parameters, stream, rlHandler);
			return;
		case "#builtin-test-code0":
			emitDataOnStream("builtin-test output with code 1", stream, false);
			stream.emit("close");
			return;
		default:
			stream.emit(
				"close",
				new Error(`This builtin operation doesn't exist: ${operationName}`)
			);
	}
};
