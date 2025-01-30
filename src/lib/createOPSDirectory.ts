/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/27/24
 */

import readline from "node:readline";
import { consoleLog } from "../helpers/helperUI";
import { exitNodeJs } from "./system";
import {
	legacyDirStorage,
	messageProcessCanceledByUser,
	regExpAbsolute,
	regExpRelative,
} from "./constants";
import { buildOPSDirectory } from "../helpers/helperOPSDirectory";
import { getOperationBooksPath, getOperationsPath } from "./filePathResolver";

export const createOPSDirectory = async (
	rl: readline.Interface,
	operationPath: string
) => {
	const question = () => {
		return new Promise((resolve, reject) => {
			let basePath = operationPath || legacyDirStorage;

			// if not absolute and not relative convert provided path to relative
			if (!regExpAbsolute.test(basePath) && !regExpRelative.test(basePath))
				basePath = `./${basePath}`;

			const patternEnd = /\/*$/;
			if (patternEnd.test(basePath))
				basePath = basePath.replace(patternEnd, "");

			if (regExpRelative.test(basePath)) {
				basePath = basePath.replace(regExpRelative, `${process.cwd()}/`);
			}

			const operationsInstallDir = getOperationsPath(basePath);
			const operationBooksInstallDir = getOperationBooksPath(basePath);
			consoleLog(
				`\nYou are about to create an OPS Directory in the path: ${basePath}
This action will create the directories:`,
				"yellow"
			);
			consoleLog(
				`  - ${operationsInstallDir}
  - ${operationBooksInstallDir}
`,
				"red"
			);
			rl.question(
				`Are you sure to continue ? (yes/No) `,
				async (userResponse) => {
					if (userResponse === "yes") {
						await buildOPSDirectory(
							operationsInstallDir,
							operationBooksInstallDir
						)
							.then(() => {
								consoleLog(
									`\nThe operation was successful.
Before performing operations, set the environment variable OPS:
- by prefixing the command "automation-cli" with : OPS="${basePath}"
- or using : export OPS="${basePath}"\n\n+++Enjoy\n`,
									"green"
								);
								resolve(null);
							})
							.catch((error) => {
								reject(error);
							});
					} else {
						await exitNodeJs(1, messageProcessCanceledByUser);
					}
				}
			);
		});
	};

	await question()
		.then(() => {
			exitNodeJs();
		})
		.catch((error) => {
			if (typeof error === "string") throw new Error(error);
			throw error;
		});
};
