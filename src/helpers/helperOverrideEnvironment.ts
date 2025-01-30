/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 18/01/25
 */

import { logDebugEvent } from "../lib/log";
import { KeyStringValue } from "../lib/types";

/**
 * Override 'operation.environment' with registered variables (if exist)
 */
export const overrideOperationEnvironmentWithRegisteredVariables = (
	registeredVariables: KeyStringValue,
	operationEnvironment?: KeyStringValue
): KeyStringValue => {
	if (Object.getOwnPropertyNames(registeredVariables).length > 0) {
		logDebugEvent(
			`Registered Variables set before execution operation: ${JSON.stringify(
				registeredVariables
			)}`
		);
		if (!operationEnvironment) operationEnvironment = {};
		for (const key of Object.getOwnPropertyNames(registeredVariables)) {
			operationEnvironment[key] = JSON.stringify(registeredVariables[key]);
		}
	}
	return operationEnvironment || {};
};
