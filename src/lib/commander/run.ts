/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import type { Command } from "commander";
import type readline from "node:readline";
import {
	MINUTESNOACTIVITYBEFORESHUTDOWN,
	messageProcessCanceledByUser,
} from "../constants";
import { logDebugEvent, logSetBaseDirectoryOperation } from "../log";
import { reportListHosts, reportOperationsToRun } from "../reports";
import { discoverOperationsFromCommanderOptions } from "../run/discoverOperations";
import { Spinner } from "../spinner";
import { terminateAllProcesses, exitNodeJs } from "../system";
import type { Operation, HostsType } from "../types";
import { checkIsOPSDirectory } from "../checks";
import { buildHostList } from "../../helpers/helperOperations";
import { checkOperationsBeforeRunning } from "../run/checkOperations";
import { runOperationsOnHosts } from "../run/operations";
import { resolveInventoryFilePath } from "../filePathResolver";
import { execSync } from "node:child_process";

/**
 * Run operation(s) on host(s)
 */
export const commandRun = (program: Command, rl: readline.Interface) => {
	/**
	 * -e parameter could be set multiple times in the command line
	 * needed to pass parameters to operationBook
	 * eg: -e DIR=/ -e LS="-la" -e ...
	 */

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const multipleEnvVarSupported = (value: any, previous: any[]) => {
		return previous.concat([value]);
	};

	// Important to catch the user which run the operation for system log
	if (!process.env.USER || process.env.USER.trim() === "")
		process.env.USER = execSync("whoami").toString().trim();

	if (process.env.USER.trim() === "")
		exitNodeJs(1, "Who are you ???, Impossible to continue");

	program
		.command("run")
		.description(
			"To perform operations on a remote host using ssh. Wireguard can be used if necessary (with one-tun client amd64 only)."
		)
		.option(
			"-h, --hosts <string>",
			"hosts list, host must be defined with: ipaddress|inventory Group Name[:port] (default ssh port is 22), use space to separate hosts"
		)
		.option(
			"-e, --env-var <string>",
			"shell parameters VARIABLE='YOUR VALUE'. -e could be set several times",
			multipleEnvVarSupported,
			[]
		)
		.option(
			"-i, --inventory-file <string>",
			"Absolute or relative path of inventory yaml file"
		)
		.option(
			"-y, --noconfirm",
			"Operations will be run without asking confirmation!!!"
		)
		.option(
			"-edm",
			"Try to edit the manifest file of operation or operationBook"
		)
		.option("-eds", "Try to edit script of one operation")
		.option(
			"-sshpk, --ssh-private-key <string>",
			"Provide your ssh private key file path"
		)
		.option(
			"-sshpass, --ssh-private-key-pass-phrase <string>",
			"Pass phrase to decrypt your ssh private key"
		)
		.option(
			"-c, --command <string>",
			"Command or series of commands to be executed, separated by ';'."
		)
		.option(
			"-op, --operation <string>",
			"Operation to be executed(complete sub-directory of the 'operations' directory) eg: built-in/system/apt-update"
		)
		.option(
			"-ob, --operation-book <string>",
			"Full path of the manifest containing the list of operations to be performed"
		)
		.option(
			"-wgsa, --wireguard-server-address <string>",
			"Enter Wireguard server public IP address"
		)
		.option(
			"-wgsp, --wireguard-server-port <number>",
			"Enter Wireguard server public port"
		)
		.option(
			"-wgspk, --wireguard-server-public-key <string>",
			"Enter Wireguard server public key"
		)
		.option(
			"-wgpk, --wireguard-your-private-key <string>",
			"Enter your Wireguard private key"
		)
		.option(
			"-wgip, --wireguard-your-ip-address <string>",
			"Enter your Wireguard private ip address (given by Wireguard admin)"
		)
		.option(
			"-wgma, --wireguard-match <string>",
			"Enter the regular expressions that determine which hosts must go through wireguard (eg: 172 all ip Address starting with 172)"
		)
		.option("-sudo, --sudo", "to run operation as sudo user")
		.option("-sudopass, --sudopass <string>", "password for the sudo user")
		.option(
			"-s, --silent, displays only STDERR outputs of the scripts executed (useful in cron)"
		)
		.option(
			"-q, --quiet, displays STDOUT & STDERR outputs of the scripts executed but no service messages"
		)
		.option(
			"-nl, --nolog",
			"log to file process will be deactivated, usefully when operation exposes secrets"
		)
		.option("-lh, --list-hosts", "Display hosts list and exit")
		.option("-json, --json", "option for -nl to output result as json")
		.option(
			"-actto, --activity-timeout <number>",
			`(minute) Autokill when no activity timeout is reached, default is ${MINUTESNOACTIVITYBEFORESHUTDOWN} minutes`
		)
		.action(async (_str, options) => {
			try {
				if (options._optionValues.nolog) process.env.NOLOG = "1";
				// Silent Mode
				if (options._optionValues.silent) process.env.SILENTMODE = "TRUE";
				// Quiet Mode
				if (options._optionValues.quiet) process.env.QUIETMODE = "TRUE";

				logDebugEvent(
					`Command line options detected: ${JSON.stringify(
						options._optionValues
					)}`
				);
				logDebugEvent(
					`Console size: ${process.stdout.rows} X ${process.stdout.columns} (rows X cols)`
				);

				/**
				 * 2 ways to run operation on host:
				 * - manifest (-op | -ob)
				 * - command OPS
				 */
				// if command OPS is not checked
				if (!options._optionValues.command) checkIsOPSDirectory();
				const rawOperations: Operation[] =
					await discoverOperationsFromCommanderOptions(options._optionValues);
				checkOperationsBeforeRunning(rawOperations, options._optionValues);

				logDebugEvent(
					`rawOperations detected: ${JSON.stringify(
						{
							operations: rawOperations,
							commanderOptions: options._optionValues,
						},
						null,
						4
					)}`
				);

				// resolving inventory file path
				if (options._optionValues.inventoryFile)
					options._optionValues.inventoryFile = resolveInventoryFilePath(
						options._optionValues.inventoryFile || ""
					);
				let hostsListToProceed: HostsType[] = [];
				// -h (--hosts) is mandatory
				hostsListToProceed =
					options._optionValues.Edm || options._optionValues.Eds
						? []
						: buildHostList(
								options._optionValues.hosts
									? options._optionValues.hosts
											.trim()
											.replace(/ +/, " ")
											.split(" ")
									: [],
								rawOperations,
								options._optionValues.inventoryFile
						  );

				if (options._optionValues.listHosts) {
					await reportListHosts(hostsListToProceed, options._optionValues.json);
				}

				const spinner = new Spinner("Starting process...");
				// Needed to display report confirmation
				logSetBaseDirectoryOperation();
				const _runOperation = () => {
					runOperationsOnHosts(
						spinner,
						rl,
						options._optionValues,
						rawOperations,
						hostsListToProceed
					);
				};

				// -y has been intercepted, execute without confirmation
				if (options._optionValues.noconfirm) {
					_runOperation();
				} else {
					reportOperationsToRun(rawOperations, hostsListToProceed);
					rl.question(
						"Are you sure to run operation(s) on host(s) ? (Y/[N]) ",
						(userResponse) => {
							if (userResponse === "Y") {
								_runOperation();
							} else {
								exitNodeJs(0, messageProcessCanceledByUser);
							}
						}
					);
				}
			} catch (error) {
				logDebugEvent(JSON.stringify(error));
				// eslint-disable-next-line no-console
				if (__filename.match(/\.ts$/)) console.debug(error);
				await terminateAllProcesses(1, (error as Error).toString(), rl);
			}
		});
};
