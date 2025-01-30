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
import { getOperationManifestFileContent } from "../manifests";
import { ManifestRequiredParameters, SecurityAuditResult } from "../types";

export const securityAuditOperation = (
	operationPath: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
): SecurityAuditResult | null => {
	const objectType = "operation";
	const shortcut = operationPath
		.replace(new RegExp(`${getProcessEnvValue("OPS")}/operations/`), "")
		.replace(regExpYamlExtentionFilename, "");

	const operationContent = getOperationManifestFileContent(
		operationPath,
		false
	);

	// Check environment variable content
	const warningEnvironmentVariableContent: string[] = [];

	if (operationContent.parameters) {
		if (operationContent.parameters.required) {
			for (const envVar of Object.getOwnPropertyNames(
				operationContent.parameters.required
			)) {
				const requiredVar = operationContent.parameters
					.required as ManifestRequiredParameters;
				if (
					requiredVar[envVar].default &&
					!regBashVariable.test(requiredVar[envVar].default) &&
					!regExpInventoryKey.test(requiredVar[envVar].default)
				) {
					warningEnvironmentVariableContent.push(
						`parameters.${envVar}.default specifies hard-coded values: '${requiredVar[envVar].default}'`
					);
				}
			}
		}
	}

	if (
		!commanderOptions.failed ||
		(commanderOptions.failed && warningEnvironmentVariableContent.length)
	) {
		return {
			type: objectType,
			path: operationPath,
			shortcut: shortcut,
			warning: warningEnvironmentVariableContent,
		};
	}
	return null;
};
