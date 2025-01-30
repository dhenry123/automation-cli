/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/30/24
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { ShellDescription, Operation } from "./types";
import { mkTemp } from "./system";
import { logDebugEvent } from "./log";
import {
	markProtectedServer,
	markProtectedServerMessageLine1,
	markProtectedServerMessageLine2,
} from "./constants";
import { getInternalBashFunctionsTemplate } from "./getTemplates";
import {linuxLoggerCommand} from "./security";

export const removeSheBang = (content: string) => {
	return content.replace(/^#!\/.*\n/, "");
};

/**
 * only operation type: operation | command
 * Will produce :
 * - operation : a shell script including user scripts and tmp file which will be sent to remote
 * - command: only commands provided by user - no tmp file
 */
export const buildShell = (
	operation: Operation,
	host?: string // included in shell for memory
): ShellDescription | null => {
	if (
		(!operation.scripts && !operation.command) ||
		(operation.scripts && operation.scripts.length === 0)
	)
		throw new Error(
			`[SERIOUS ERROR] The pre-check process does not operate correctly,
there is a very big bug upstream.
Reaching this point without the "scripts" or "command" attribute is not expected...`
		);

	const start = new Date().valueOf();
	const shell = [];
	let shellInstructions: string = "";
	let tmpFile: string | null = null;

	// Command is set with -c, no need to build a complete shell
	if (operation.command) {
		shellInstructions = operation.command;
	} else {
		shell.push("#!/usr/bin/env bash");
		if (host) shell.push(`# built for ${host}`);

		if (
			operation.environment &&
			Object.getOwnPropertyNames(operation.environment).length > 0
		) {
			shell.push(
				"\n#[WARN] These variables must be declared before running this shell"
			);
			for (const paramCmdLine of Object.getOwnPropertyNames(
				operation.environment
			)) {
				shell.push(`# -e ${paramCmdLine}="(Real value is hidden)"`);
			}
			shell.push("####\n");
		}

		// insert logger command
		shell.push(linuxLoggerCommand(`${process.env.OPS} => ${operation.operationBook ? 'operationBook' : "operation"}: ${operation.name}`))
		// source /etc/profile
		shell.push("if [ -d /etc/profile.d ]; then source /etc/profile;fi");
		// -e: exit on the first error (set +e in process to deactivate this feature, and set -e to reactivate)
		// -u: to prevent using variable not set
		// -o pipefail: prevents errors in a pipeline from being masked
		shell.push("set -euo pipefail");
		// history expand to capture changes
		shell.push("set -o history -o histexpand");
		// Using Corporate proxy
		shell.push(`profileCorporateProxy="/etc/profile.d/proxy.sh"`);
		shell.push(`if [ -f "$profileCorporateProxy" ];then`);
		// source profile to be able to reach internet if needed
		shell.push(`  . "$profileCorporateProxy"`);
		shell.push(`fi`);

		// For debug only
		//shell.push('set -x');
		// Auto clean shell to execute
		shell.push('if [ -f "$0" ];then rm -f "$0";fi');
		shell.push(
			getInternalBashFunctionsTemplate()
				.replace(
					/##markProtectedServerMessageLine1##/g,
					markProtectedServerMessageLine1
				)
				.replace(
					/##markProtectedServerMessageLine2##/g,
					markProtectedServerMessageLine2
				)
				.replace(/##markProtectedServer##/g, markProtectedServer)
		);
		// is executable on this server : protection against running automation-cli on remote server
		shell.push("checkIsServerProtected");
		shell.push('export APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE="DontWarn"');
		shell.push('export DEBIAN_FRONTEND="noninteractive"');

		// is there dependencies ?
		if (
			operation.dependencies &&
			Array.isArray(operation.dependencies) &&
			operation.dependencies.length > 0
		) {
			shell.push(`\n# ==> Your manifest contains package dependencies`);
			shell.push(`debInstall "${operation.dependencies.join(" ")}"\n##\n`);
		}

		shell.push(`# ==> Starting your shell instructions`);

		// Test Needed by typescript compiler but tested at the beginning !!
		if (operation.scripts)
			for (const scriptFile of operation.scripts) {
				if (existsSync(scriptFile)) {
					logDebugEvent(`buildShell: Script filename to Read: ${scriptFile}`);
					const scriptContent = removeSheBang(
						readFileSync(scriptFile, "utf-8")
					).split("\n");
					// shell commands
					shell.push(`# ===> Adding the script:: ${scriptFile}`);
					scriptContent.forEach((line) => {
						shell.push(line);
					});
					shell.push(`# <=== End of script: ${scriptFile}`);
				}
			}

		shell.push(`# Ending your shell instructions`);

		shellInstructions = shell.join("\n");
		// Tmp file to transfert to remote
		tmpFile = mkTemp();

		if (shellInstructions.trim()) {
			writeFileSync(tmpFile, shellInstructions, "utf-8");
		}
	}
	return {
		shellInstructions: shellInstructions,
		tmpFile: tmpFile,
		timeToBuild: new Date().valueOf() - start,
	};
};

export const deleteTmpBashFile = (tmpFile: string | null) => {
	if (tmpFile && existsSync(tmpFile)) rmSync(tmpFile);
};

export const addLineNumberToShell = (content: string[]) => {
	let result = "";
	let lineNumber = 1;
	for (const line of content) {
		const char = " ";
		result += `${lineNumber}${char.repeat(
			5 - String(lineNumber).length
		)} ${line}\n`;
		lineNumber++;
	}
	return result;
};
