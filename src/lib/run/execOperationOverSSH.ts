/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { readFileSync } from "fs";
import {
	Client,
	ClientChannel,
	ClientErrorExtensions,
	SFTPWrapper,
} from "ssh2";

import { ShellDescription, HostsType, Operation, CopyTo } from "../types";
import { buildShellCommand, emitDataOnStream } from "./execOperation";
import {
	logDebugEvent,
	logHostEvent,
	logInstructionToExecute,
	logUserInfo,
} from "../log";

import path from "node:path";
import {
	buildBashParametersFromOperationsParameters,
	getLogCopyTo,
	getLogErrorCopyTo,
	resolveLocalSrcFileToCopy,
} from "../../helpers/helperOperations";
import { getDefaultSshPrivateKey } from "../system";
import { deleteTmpBashFile } from "../bash";
import {
	markProtectedServer,
	markProtectedServerMessageLine1,
	markProtectedServerMessageLine2,
} from "../constants";
import { linuxLoggerCommand } from "../security";

export const sendFile = (
	sftpHandler: SFTPWrapper,
	sourcefile: string,
	destinationFile: string,
	host: HostsType,
	chmod?: string
) => {
	return new Promise((resolve, reject) => {
		const finalDestination = /\//.test(destinationFile)
			? destinationFile
			: `/tmp/${path.basename(destinationFile)}`;
		sftpHandler.fastPut(sourcefile, finalDestination, (error) => {
			// doesn't stop for other target
			if (error) {
				reject(error);
			}

			logHostEvent(
				host.userInput,
				`[INFO] File transfered: ${finalDestination} to remote ${host.toPerform}`
			);
			if (chmod) {
				logDebugEvent(
					`[INFO] Trying to chmod: ${chmod} file: ${destinationFile}`
				);
				sftpHandler.chmod(finalDestination, chmod, (error) => {
					// doesn't stop for other target
					if (error) {
						reject(error);
					}
					resolve(null);
				});
			} else {
				resolve(null);
			}
		});
	});
};

export const executeShell = (
	bashParameters: string,
	shell: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any,
	conn: Client
) => {
	const cmdShell = buildShellCommand(bashParameters, commanderOptions, shell);
	logDebugEvent(`cmdShell: ${cmdShell}`);
	// Warn do not activate for production, could expose secrets
	connExecAndStreamEvents(conn, cmdShell);
};

export const execOperationOverSsh = (
	shellDescription: ShellDescription,
	host: HostsType,
	operation: Operation,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
) => {
	logDebugEvent(
		`execOperationOverSsh: commanderOptions.sshPrivateKey: '${commanderOptions.sshPrivateKey}'`
	);
	const conn = new Client();
	const bashParameters: string = buildBashParametersFromOperationsParameters(
		operation.environment || {}
	);
	const logMessage = "[INFO] Using ssh";
	logUserInfo(host.userInput);
	logHostEvent(host.userInput, logMessage);
	logInstructionToExecute(host.userInput, shellDescription);

	// upload built shell to remote
	let finalShellFile = "";

	getDefaultSshPrivateKey(commanderOptions);
	logDebugEvent(`sshPrivateKey used: ${commanderOptions.sshPrivateKey}`);

	const cmdLogger = linuxLoggerCommand(shellDescription.shellInstructions);
	const runShell = () => {
		logDebugEvent(
			`Operation: ${operation.name} - Environment to inject: ${bashParameters}`
		);
		// check server is protected in line when -c is invoked
		// Warn impossible to send the message to stderr - when i trace in connExecAndStreamEvents, message is received by stdout.
		// don't want to waste time with this
		executeShell(
			bashParameters,
			finalShellFile
				? `bash "${finalShellFile}"`
				: `bash -c "if [ -f '${markProtectedServer}' ];then echo '${markProtectedServerMessageLine1}\n${markProtectedServerMessageLine2.replace(
						/##markProtectedServer##/g,
						markProtectedServer
				  )}' >/dev/stderr;exit 2;fi && ${cmdLogger} && ${
						shellDescription.shellInstructions
				  }"`,
			commanderOptions,
			conn
		);
	};
	// set connection parameters - if wireguard or not
	const splitHostToPerform = host.toPerformOverWireguardVpn
		? host.toPerformOverWireguardVpn.split(":")
		: host.toPerform.split(":");
	const finalHost = splitHostToPerform[0];
	const finalPort = splitHostToPerform[1]
		? parseInt(splitHostToPerform[1])
		: 22;
	const finalLogin = splitHostToPerform[2] || "root";
	conn
		.on("ready", async () => {
			if (
				shellDescription.tmpFile ||
				(operation.copyTo && operation.copyTo.length)
			) {
				// Building files list to upload
				const filesListToUpload: CopyTo[] = [];
				if (operation.copyTo) {
					logDebugEvent(
						`execOperationOverSsh - operation.copyTo detected: ${JSON.stringify(
							operation.copyTo,
							null,
							4
						)}`
					);
					for (const data of operation.copyTo) {
						filesListToUpload.push({
							src: resolveLocalSrcFileToCopy(operation.name, data.src),
							dest: data.dest,
							chmod: data.chmod,
						});
					}
				}
				// Warn if sending to localhost using the ip address of netword card, file src will be the same and lead permission denied error
				if (shellDescription.tmpFile) {
					// So destination file include one A at the end of string
					finalShellFile = `${shellDescription.tmpFile}A`;
					filesListToUpload.push({
						src: shellDescription.tmpFile,
						dest: finalShellFile,
					});
				}

				// The shell built from operation must be upload to remote server using existing ssh connection
				conn.sftp(async (error, sftpHandler) => {
					if (error) {
						throw error;
					}
					for (const data of filesListToUpload) {
						logDebugEvent(
							`execOperationOverSsh - Trying to upload files: ${data.src} to ${data.dest}`
						);
						try {
							await sendFile(
								sftpHandler,
								data.src,
								data.dest,
								host,
								data.chmod
							);
							logDebugEvent(
								`execOperationOverSsh - ${getLogCopyTo(
									data.src,
									data.dest,
									host.toPerform
								)}`
							);
						} catch (error) {
							conn.emit(
								"error",
								new Error(getLogErrorCopyTo(error as Error, data))
							);
							return;
						}
					}
					logDebugEvent(
						`execOperationOverSsh - Trying to delete ${shellDescription.tmpFile}`
					);
					// Deleting local tmp bash file
					deleteTmpBashFile(shellDescription.tmpFile);
					runShell();
				});
			} else {
				runShell();
			}
		})
		.on("error", (error) => {
			logDebugEvent(
				`execOperationOverSsh - on error - ${JSON.stringify(
					error as ClientErrorExtensions,
					null,
					4
				)}`
			);
			conn.emit("close", error);
		})
		// SSH connection to remote server
		.connect({
			host: finalHost,
			port: finalPort,
			username: finalLogin,
			privateKey: readFileSync(commanderOptions.sshPrivateKey, "utf-8"),
			passphrase: commanderOptions.sshPrivateKeyPassPhrase
				? commanderOptions.sshPrivateKeyPassPhrase
				: undefined,
		});
	logDebugEvent(
		`execOperationOverSsh - Trying to ssh connect to host: ${finalHost} - port: ${finalPort} - username: ${finalLogin}`
	);
	return conn;
};

/**
 * Connection is ok, exec command on remote
 */
export const connExecAndStreamEvents = (conn: Client, cmdShell: string) => {
	conn.exec(
		cmdShell,
		{ pty: true },
		(error: Error | undefined, stream: ClientChannel) => {
			if (error) throw error;
			stream
				.on("exit", (exitcode: number) => {
					// Important everythings is asynchronous...
					setTimeout(() => {
						conn.end();
						conn.emit("endConn", exitcode);
					}, 5);
				})
				.stdout.on("data", (data: string) => {
					emitDataOnStream(data, conn, false);
				})
				.stderr.on("data", (data) => {
					emitDataOnStream(data, conn, true);
				});
		}
	);
};
