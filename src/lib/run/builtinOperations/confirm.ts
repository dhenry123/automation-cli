/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { builtinGetParameterValues } from "../../../helpers/helperOperations";
import { messageCanceledByUser } from "../../constants";
import { DuplexStream } from "../../DuplexStream";
import { logDebugEvent } from "../../log";
import {
	BuiltinValuesToObject,
	ExecBuiltinOperationParameters,
} from "../../types";
import { emitDataOnStream } from "../execOperation";
import { ReadLine } from "readline";
import colors from "colors";

export const builtinConfirm = async (
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream,
	rlHandler: ReadLine
) => {
	const execParameters: BuiltinValuesToObject = builtinGetParameterValues(
		parameters.hostToPerform,
		parameters.values
	);

	logDebugEvent(
		`builtinConfirm, execParameters: ${JSON.stringify(
			execParameters,
			null,
			4
		)}`,
		false
	);

	emitDataOnStream(
		`[Builtin Confirm] Host: ${execParameters.host}:${execParameters.port}`,
		stream,
		false
	);
	rlHandler.question(
		colors.red("Confirm to continue: Y/(N)"),
		(userResponse) => {
			if (userResponse === "Y") {
				stream.emit("close");
			} else {
				stream.emit("close", messageCanceledByUser);
			}
		}
	);
	return;
};
