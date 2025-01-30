/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 18/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { appendFileSync, existsSync, writeFileSync } from "fs";
import { discoverOperationsFromCommanderOptions } from "../run/discoverOperations";
import {
	ManifestOptionalParameters,
	ManifestRequiredParameters,
} from "../types";
import { resolveAbsolutePathOperationBookManifest } from "../filePathResolver";
import { consoleLog } from "../../helpers/helperUI";
import { securityValueIsPureString } from "../security";

/**
 * To create an operationBook
 */
export const commandAddOperationToOperationBook = (program: Command) => {
	program
		.command("obaddop")
		.description("Add operation yaml description to an operationBook")
		.requiredOption(
			"-op, --operation <string>",
			"Operation name to include in operationBook eg: debian/system/apt-update"
		)
		.requiredOption(
			"-ob, --operationBook <string>",
			"operationBook target name (existing or new)"
		)
		.action(async (_str, options) => {
			try {
				const rawOperations = await discoverOperationsFromCommanderOptions(
					options._optionValues
				);
				if (rawOperations.length === 1) {
					const operation = rawOperations[0];
					let outputYaml = "";

					// Comment
					let comment = "WARN: No comment for this operation";
					if (operation.comment)
						comment = `(on ${new Date().toISOString()}) ${operation.comment}`;

					outputYaml += `  - operation: ${operation.name}`;
					outputYaml += `\n    #comment: '${comment}'`;

					if (
						operation.parameters &&
						(operation.parameters.required || operation.parameters.optional)
					) {
						outputYaml += `\n    environment:`;
					}
					// Required
					if (operation.parameters && operation.parameters.required) {
						const parametersRequired = operation.parameters
							.required as ManifestRequiredParameters;
						const parameterKeys =
							Object.getOwnPropertyNames(parametersRequired);
						if (parameterKeys.length) {
							outputYaml += `\n      # Required parameters - Uncomment lines you want to use (or use -e VARIABLENAME="Your value")`;
							for (const parameter of parameterKeys) {
								outputYaml += `\n      #${parameter}: "Your value"${
									parametersRequired[parameter].comment
										? ` # ${parametersRequired[parameter].comment}`
										: ""
								} ${
									securityValueIsPureString(
										parametersRequired[parameter].default
									)
										? ` - DEFAULT VALUE IS: ${parametersRequired[parameter].default}`
										: ""
								}
								`;
							}
						}
					}
					// Optional
					if (operation.parameters && operation.parameters.optional) {
						const parametersOptional = operation.parameters
							.optional as ManifestOptionalParameters;
						const paremeterKeys =
							Object.getOwnPropertyNames(parametersOptional);
						if (paremeterKeys.length) {
							outputYaml += `\n      # Optional parameters - Uncomment lines you want to use (or use -e VARIABLENAME="Your value")`;
							for (const parameter of paremeterKeys) {
								outputYaml += `\n      #${parameter}: "Your value"${
									parametersOptional[parameter].comment
										? `\n # ${parametersOptional[parameter].comment}`
										: ""
								}`;
							}
						}
					}
					// consoleLog(outputYaml);
					const operationBookYamlFile =
						resolveAbsolutePathOperationBookManifest(
							options._optionValues.operationBook
						);
					if (!existsSync(operationBookYamlFile)) {
						writeFileSync(
							operationBookYamlFile,
							`operations:\n${outputYaml}`,
							"utf-8"
						);
					} else {
						appendFileSync(operationBookYamlFile, `\n${outputYaml}`, "utf-8");
					}
					consoleLog(
						`The operation: ${operation.name} has been added to the operationBook: ${operationBookYamlFile}`,
						"green"
					);
				}
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
