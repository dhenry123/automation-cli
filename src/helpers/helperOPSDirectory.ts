/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/27/24
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";

export const buildOPSDirectory = (
	operationsInstallDir: string,
	operationBooksInstallDir: string
) => {
	return new Promise((resolve, reject) => {
		// operations directory
		if (existsSync(operationsInstallDir)) {
			reject(`This directory already exists: ${operationsInstallDir}`);
			return;
		} else {
			mkdirSync(operationsInstallDir, { recursive: true });
			// .keep to be kept by git
			writeFileSync(`${operationsInstallDir}/.keep`, "", "utf-8");
		}
		// operationBooks directory
		if (existsSync(operationBooksInstallDir)) {
			reject(`This directory already exists: ${operationBooksInstallDir}`);
			return;
		} else {
			mkdirSync(operationBooksInstallDir, { recursive: true });
			writeFileSync(`${operationBooksInstallDir}/.keep`, "", "utf-8");
		}
		resolve(null);
	});
};
