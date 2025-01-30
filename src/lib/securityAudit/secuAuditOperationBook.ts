/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { getProcessEnvValue } from "../system";
import {
	regBashVariable,
	regExpInventoryKey,
	regExpYamlExtentionFilename,
} from "../constants";
import { getOperationBookManifestFileContent } from "../manifests";
import { SecurityAuditResult } from "../types";

export const securityAuditOperationBook = (
	operationBookPath: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
): SecurityAuditResult | null => {
	const objectType = "operationBook";
	const shortcut = operationBookPath
		.replace(new RegExp(`${getProcessEnvValue("OPS")}/operationBooks/`), "")
		.replace(regExpYamlExtentionFilename, "");

	// Check environment variable content
	const warningEnvironmentVariableContent: string[] = [];

	try {
		const operationBookContent =
			getOperationBookManifestFileContent(operationBookPath);
		for (const operation of operationBookContent) {
			if (operation.environment) {
				for (const envVar of Object.getOwnPropertyNames(
					operation.environment
				)) {
					if (
						!regBashVariable.test(operation.environment[envVar]) &&
						!regExpInventoryKey.test(operation.environment[envVar])
					) {
						warningEnvironmentVariableContent.push(
							`environment.${envVar} specifies hard-coded values: '${operation.environment[envVar]}'`
						);
					}
				}
			}
		}
	} catch (error) {
		warningEnvironmentVariableContent.push((error as Error).toString());
	}

	if (
		!commanderOptions.failed ||
		(commanderOptions.failed && warningEnvironmentVariableContent.length)
	) {
		return {
			type: objectType,
			path: operationBookPath,
			shortcut: shortcut,
			warning: warningEnvironmentVariableContent,
		};
	}
	return null;
};
