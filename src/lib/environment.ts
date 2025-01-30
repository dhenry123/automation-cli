/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { KeyStringValue, ManifestParametersType } from "./types";

export const convCommanderOptionsEnvVarToKeyValueObject = (
	envVarsList: string[]
): KeyStringValue => {
	const envVarAsObject: KeyStringValue = {};
	for (const envVar of envVarsList) {
		const parts = envVar.split(/=(.+)/);
		if (parts.length !== 3 || parts[2] !== "")
			throw new Error(
				`Environment variable: '${envVar}' is malformed. The correct form is MYVARNAME="value".`
			);
		envVarAsObject[parts[0]] = parts[1];
	}
	return envVarAsObject;
};

/**
 * This method override operationEnvironment key with environment provided by user with -e ...
 */
export const environmentOverride = (
	operationBookEnvironment: KeyStringValue,
	environmentFromCommanderOption: string[],
	operationParameters?: ManifestParametersType
): KeyStringValue => {
	const finalEnvironment: KeyStringValue = {};
	const environmentFromCommanderOptionToObject =
		convCommanderOptionsEnvVarToKeyValueObject(environmentFromCommanderOption);

	for (const envVar of Object.getOwnPropertyNames(operationBookEnvironment)) {
		// default is operationBook
		finalEnvironment[envVar] = operationBookEnvironment[envVar];
	}

	// Override with Commander option -e if provided
	for (const envVar of Object.getOwnPropertyNames(
		environmentFromCommanderOptionToObject
	)) {
		if (environmentFromCommanderOptionToObject[envVar].trim())
			finalEnvironment[envVar] = environmentFromCommanderOptionToObject[envVar];
	}

	if (operationParameters) {
		// Required
		if (operationParameters.required) {
			for (const envVar of Object.getOwnPropertyNames(
				operationParameters.required
			)) {
				// Required & provided in environmentFromCommanderOptionToObject
				if (environmentFromCommanderOptionToObject[envVar])
					finalEnvironment[envVar] =
						environmentFromCommanderOptionToObject[envVar];
			}
		}
		// Optional
		if (operationParameters.optional) {
			for (const envVar of Object.getOwnPropertyNames(
				operationParameters.optional
			)) {
				// optional & provided in environmentFromCommanderOptionToObject
				if (environmentFromCommanderOptionToObject[envVar])
					finalEnvironment[envVar] =
						environmentFromCommanderOptionToObject[envVar];
			}
		}
	}
	return finalEnvironment;
};

/**
 * convert environment objet to string[] => KEY="value"
 */
export const convertEnvironmentObjectToStringArray = (
	environment: KeyStringValue
): string[] => {
	const result: string[] = [];
	for (const key of Object.getOwnPropertyNames(environment)) {
		result.push(`${key}="${environment[key]}"`);
	}
	return result;
};
