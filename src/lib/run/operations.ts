/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import {
	ShellDescription,
	Operation,
	HostsType,
	ExecOperationHostErrorType,
	ShellOutput,
	KeyNumberValue,
	KeyStringValue,
} from "../types";
import { ClientErrorExtensions } from "ssh2";
import { getProcessEnvValue, terminateAllProcesses } from "../system";
import { startVpn } from "../vpn";
import { Spinner } from "../spinner";
import { ReadLine } from "readline";

import {
	consoleErr,
	consoleLog,
	displayHostLogFile,
} from "../../helpers/helperUI";
import {
	execOperationOneHost,
	logShellExecutionStarting,
} from "./execOperation";
import { logDebugEvent, logHostEvent } from "../log";
import { reportHostsShellExecution } from "../reports";
import { messageProcessCanceledByUser } from "../constants";
import { checkDirectoryExists } from "../checks";
import {
	isOperationCanBePerformedByHost,
	isBuiltInOperation,
	waitForOperationCompletedOnAllHosts,
	activateAutoKillHostNoActivity,
	incrementHostActivity,
} from "../../helpers/helperOperations";
import { overrideOperationEnvironmentWithRegisteredVariables } from "../../helpers/helperOverrideEnvironment";
import {
	stepAddHostToHostsListCompleted,
	stepBuildShell,
	stepCollectVpnInfosFromInventory,
	stepInterpolateEnvironmnentWithInventoryValues,
	stepRemoveHostFromListToProceed,
	stepRunEventDataFromBash,
	stepRunEventEndConn,
	stepRunEventError,
	stepWhenCondition,
} from "./runSteps";

export const runOperationsOnHosts = async (
	spinner: Spinner,
	rlHandler: ReadLine,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	optionsCommandLine: any,
	operations: Operation[],
	hostsListToProceed: HostsType[]
) => {
	// UX: display logs files at the begining if noconfirm && !silent mode : do not display if executed with cron
	displayHostLogFile(hostsListToProceed, optionsCommandLine.noconfirm);

	logDebugEvent(
		`runOperationsOnHosts: value hostsListToProceed:
		${JSON.stringify(hostsListToProceed)}`
	);

	// pid of vpn onetun
	let vpnPid = 0;

	// create run log operation
	checkDirectoryExists(getProcessEnvValue("DIRECTORYLOGOPERATION"));

	// Copy hosts list
	const initHostsToExec = [...hostsListToProceed];

	// list of complete host for each operation
	let hostsListCompleted: string[];

	// report resume for each host
	const hostsResume: ExecOperationHostErrorType[] = [];

	// counter of number of changes for each host
	const hostCounterChanges: KeyNumberValue = {};
	for (const host of hostsListToProceed) {
		hostCounterChanges[host.userInput] = 0;
	}

	const startRunningOperation = new Date().valueOf(); //milliseconds

	// Trying to get infos from inventory (if provided)
	stepCollectVpnInfosFromInventory(optionsCommandLine);

	// Intercept SIGINT signal (CTRL+C)
	process.on("SIGINT", () => {
		terminateAllProcesses(
			2,
			messageProcessCanceledByUser,
			rlHandler,
			spinner,
			vpnPid
		);
	});

	/**
	 * Auto killer when operation doen't provide activity
	 */
	activateAutoKillHostNoActivity(
		rlHandler,
		spinner,
		vpnPid,
		optionsCommandLine.activityTimeout
	);

	// Start spinner
	spinner.spin(process.stdout.rows);

	try {
		// Connect to VPN if needed
		vpnPid = await startVpn(
			hostsListToProceed,
			optionsCommandLine.wireguardServerAddress,
			optionsCommandLine.wireguardServerPort,
			optionsCommandLine.wireguardServerPublicKey,
			optionsCommandLine.wireguardYourPrivateKey,
			optionsCommandLine.wireguardYourIpAddress,
			optionsCommandLine.wireguardMatch
		);
		if (vpnPid) {
			consoleLog(`[*] VPN is started (pid: ${vpnPid})`, "green");
		}

		// Registered variables collector
		const RegisteredVariables: KeyStringValue = {};

		logDebugEvent(
			`runOperationsOnHosts: operations value: ${JSON.stringify(
				operations,
				null,
				4
			)}`
		);

		let currentOperationNumber = 1;
		for (const operation of operations) {
			/**
			 * Starting operation process:
			 * is there some host in Queue ?
			 * - yes: init hostsListCompleted Queue to empty
			 * - no: no host for this operation, go to next operation
			 */
			logDebugEvent(
				`runOperationsOnHosts: Running operation ${
					operation.name
				}  - hostsListToProceed: ${JSON.stringify(hostsListToProceed)}`
			);
			if (hostsListToProceed.length > 0) {
				hostsListCompleted = [];
			} else {
				// go to next operation
				break;
			}

			/**
			 * Before running on host create an original copy of environment which could be altered for host
			 * So each host start with a copy of the original environement
			 * case: EnvVar contains $host: #inv.workstation.$host.hostname....
			 */
			const environmentCopy = { ...operation.environment };
			for (const host of hostsListToProceed) {
				// set copy of original environment
				operation.environment = { ...environmentCopy };
				// Registered variables: Override operation.environmment
				operation.environment =
					overrideOperationEnvironmentWithRegisteredVariables(
						RegisteredVariables,
						operation.environment
					);
				logDebugEvent(
					`runOperationsOnHosts: processing host: ${JSON.stringify(
						host
					)} - operation environment: ${JSON.stringify(operation.environment)}`
				);
				// Check limitHost
				if (!isOperationCanBePerformedByHost(operation, host)) {
					stepAddHostToHostsListCompleted(host, hostsListCompleted);
					logDebugEvent(
						`runOperationsOnHosts: host is not included in the operation.limitHost attribute`
					);
					continue;
				}
				// adding host to environment as $host=host.userInput (IMPORTANT not host.toPerform)
				// before all method which try to resolv $host from environment
				if (!operation.environment) operation.environment = {};
				operation.environment["host"] = host.userInput;
				logDebugEvent(
					`runOperationsOnHosts: injecting host="${host.userInput}" in execution environment`
				);

				if (
					!stepWhenCondition(
						host,
						hostsListCompleted,
						operation,
						optionsCommandLine,
						currentOperationNumber,
						operations.length
					)
				)
					continue;
				spinner.setText(
					`Host to process: ${host.userInput} for operation: "${operation.name}"`
				);

				if (
					!stepInterpolateEnvironmnentWithInventoryValues(
						optionsCommandLine,
						operation,
						host,
						hostsListToProceed,
						hostsListCompleted,
						hostsResume
					)
				)
					continue;

				// Build shell to process
				const shellDescription: ShellDescription | null = stepBuildShell(
					operation,
					host
				);
				logDebugEvent(
					`runOperationsOnHosts-shellDescription value: ${JSON.stringify(
						shellDescription,
						null,
						4
					)}`
				);

				// exec operation on host
				if (shellDescription?.shellInstructions) {
					const startingTimeProcess = new Date();

					logShellExecutionStarting(host, operation.name, startingTimeProcess);
					incrementHostActivity();
					execOperationOneHost(
						shellDescription,
						host,
						{ ...operation }, // because it's asynchronous, be sure to send the current contents of the operation (a copy)
						optionsCommandLine,
						spinner,
						rlHandler
					)
						.then((promiseExecOperation) => {
							// Listener for event coming from execution processes
							// - exec bash over ssh
							// - exec bash on local terminal
							// - exec builtin methods
							// Common between type of execution objectS

							// Security Warning displayed once
							// eslint-disable-next-line prefer-const
							let alreadyDisplayed = false;

							const outputLines: ShellOutput[] = [];
							if (promiseExecOperation?.connexion) {
								// error
								promiseExecOperation.connexion.on(
									"error",
									(error: Error & ClientErrorExtensions) => {
										stepRunEventError(promiseExecOperation, host, error);
									}
								);
								// listening on event 'dataFromBash'
								promiseExecOperation.connexion.addListener(
									"dataFromBash",
									(line: ShellOutput) => {
										stepRunEventDataFromBash(
											operation,
											host,
											line,
											outputLines,
											alreadyDisplayed,
											spinner
										);
									}
								);
								// listening on event 'endConn'
								promiseExecOperation.connexion.addListener(
									"endConn",
									(error: Error) => {
										hostsListToProceed = stepRunEventEndConn(
											promiseExecOperation,
											operation,
											host,
											hostsListCompleted,
											startRunningOperation,
											error,
											currentOperationNumber,
											operations.length,
											outputLines,
											RegisteredVariables,
											hostCounterChanges,
											shellDescription,
											hostsResume,
											hostsListToProceed
										);
									}
								);
								// stream is ready - aucun impact sur les autres constaté virer la condition
								if (
									operation.operation &&
									isBuiltInOperation(operation.operation)
								) {
									promiseExecOperation.connexion.emit("ready");
									incrementHostActivity();
								}
							} else {
								throw new Error(
									`The stream for this host has not been created, so an error may have been detected when copying one file.`
								);
							}
						})
						.catch((error: Error) => {
							incrementHostActivity();
							if (!getProcessEnvValue("SILENTMODE"))
								consoleErr(`\n[ERROR] ${error.message}`);
							hostsResume.push({
								host: host.userInput,
								operationError: operation.name,
							});
							stepAddHostToHostsListCompleted(host, hostsListCompleted);
							logHostEvent(host.userInput, JSON.stringify(error));
							// finished for this host, others continue
							// Remove host from list
							hostsListToProceed = stepRemoveHostFromListToProceed(
								host,
								hostsListToProceed
							);
						});
				} else {
					stepAddHostToHostsListCompleted(host, hostsListCompleted);
				}
			}
			// waiting for operation executed on all hosts, scannig content of variable: hostsListCompleted
			await waitForOperationCompletedOnAllHosts(
				hostsListCompleted,
				initHostsToExec
			);
			incrementHostActivity();
			currentOperationNumber++;
		}
		// Display resume report
		setTimeout(() => {
			reportHostsShellExecution(
				initHostsToExec,
				hostsResume,
				hostCounterChanges,
				startRunningOperation,
				vpnPid
			);
			// Exit code 0 if all operations Ok otherwise 1
			const isError = !!hostsResume.map((item) => {
				return item.operationError;
			})[0];
			logDebugEvent(`isError in operations ? ${isError}`);
			terminateAllProcesses(isError ? 1 : 0, "", rlHandler, spinner, vpnPid);
		}, 5);
	} catch (error) {
		logDebugEvent(JSON.stringify(error));
		// eslint-disable-next-line no-console
		if (__filename.match(/\.ts$/)) console.debug(error);
		setTimeout(() => {
			terminateAllProcesses(
				1,
				(error as Error).toString(),
				rlHandler,
				spinner,
				vpnPid
			);
		}, 1000);
	}
};
