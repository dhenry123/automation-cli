/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import readline from "node:readline";

import { checkUserShellEnvironment } from "./lib/checks";
import { setOPSBasePath, terminateAllProcesses } from "./lib/system";
import { logSetBaseDirectory } from "./lib/log";
import { commandAddOperationToOperationBook } from "./lib/commander/addOperationToOperationBook";
import { commandCatalogOperations } from "./lib/commander/catalogOperations";
import { commandClearLogs } from "./lib/commander/clearLogs";
import { commandCreateOperation } from "./lib/commander/createOperation";
import { commandCreateOperationBook } from "./lib/commander/createOperationBook";
import { commandCreateOPSDirectory } from "./lib/commander/createOPSDirectory";
import { commandEdit } from "./lib/commander/edit";
import { commandExportOperation } from "./lib/commander/exportOperation";
import { commandImportOperation } from "./lib/commander/importOperation";
import { commandListen } from "./lib/commander/listenUdp";
import { commandRun } from "./lib/commander/run";
import { commandTreeOperations } from "./lib/commander/treeOperations";
import { commandCreateInventory } from "./lib/commander/createInventory";
import { APPLICATION_VERSION, messageCanceledByUser } from "./lib/constants";
import { commandVersion } from "./lib/commander/version";
import { commandDependenciesList } from "./lib/commander/dependenciesList";
import { commandBashAutoComplete } from "./lib/commander/bashAutoComplete";
import { commandSearch } from "./lib/commander/search";
import { commandServe } from "./lib/commander/serve";
import { commandSecurityAudit } from "./lib/commander/securityAudit";

const program = new Command();

try {
	// Checking the starting environment
	checkUserShellEnvironment();

	// OPS env var support shortcut ~/ but not nodejs
	setOPSBasePath();

	// Logs is very important in operations
	logSetBaseDirectory();

	// used to ask question to user
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	program
		.name(__filename.replace(/^.*\/|\..*$/g, ""))
		.usage(
			"command [options] - Default OPS directory is /var/lib/automation-cli/ - OPS directory could be change by setting environment OPS=[your operations base directory] - to activate debug: set environment variable MYTINYDCDEBUG=1"
		)
		.description(
			"CLI to manage MytinyDC datacenter or to execute operations on remote servers"
		)
		.version(
			`@Mytinydc.com - [automation-cli version: ${APPLICATION_VERSION}]`
		);

	/**
	 * Create
	 */
	commandCreateOPSDirectory(program, rl);

	commandCreateOperation(program);

	commandCreateOperationBook(program);

	commandCreateInventory(program);

	/**
	 * READ
	 */
	commandTreeOperations(program);
	commandCatalogOperations(program);
	commandExportOperation(program);
	commandDependenciesList(program);
	commandSearch(program);

	/**
	 * UPDATE
	 */
	commandAddOperationToOperationBook(program);
	commandEdit(program);
	commandImportOperation(program, rl);

	/**
	 * DELETE
	 */
	commandClearLogs(program, rl);

	/**
	 * EXEC
	 */
	commandRun(program, rl);

	/**
	 * MISC
	 */
	commandVersion(program);

	commandBashAutoComplete(program);

	commandListen(program);

	commandServe(program);

	commandSecurityAudit(program);

	// system signals interception

	process.on("SIGINT", async () => {
		terminateAllProcesses(1, messageCanceledByUser);
	});

	program.parse();
} catch (error) {
	terminateAllProcesses(
		1,
		(error as Error).message
			? (error as Error).message
			: (error as Error).toString()
	);
}
