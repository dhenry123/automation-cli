/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { HostsType } from "./types";
import { logCommonEvent, logHostEvent } from "./log";
import { consoleLog } from "../helpers/helperUI";
import { getProcessEnvValue } from "./system";
import { obfuscationString, prefixCommonLog } from "./constants";
import { controlNodeGetTcpFreePort } from "../helpers/HelperNetworkV4";

export const startVpn = async (
	hostsToInspect: HostsType[],
	endPointAddrIp: string,
	endPointAddrPort: number,
	endpointPublicKey: string,
	privateKey: string,
	sourcePeerIp: string,
	match: string,
	toRun: boolean = true
): Promise<number> => {
	// all vpn parameters must be provided
	if (
		!hostsToInspect.length ||
		!endPointAddrIp ||
		!endPointAddrPort ||
		!endpointPublicKey ||
		!privateKey ||
		!sourcePeerIp ||
		!match
	) {
		return 0;
	}
	// establishing list of host which need to be processed over vpn
	for (let i = 0; i < hostsToInspect.length; i++) {
		if (hostsToInspect[i].toPerform.match(new RegExp(match))) {
			hostsToInspect[i].toPerformOverWireguardVpn = "1"; // vpn eligible
		}
	}

	// creating VPN
	return await vpnConnect(
		endPointAddrIp,
		endPointAddrPort,
		endpointPublicKey,
		privateKey,
		hostsToInspect,
		sourcePeerIp,
		toRun
	);
};

export const obfuscateVpnShellCommand = (command: string) => {
	// step-by-step to make things clear
	return command
		.replace(/(--private-key )[^!.?\s]* /, `$1${obfuscationString} `)
		.replace(/(--endpoint-public-key )[^!.?\s]* /, `$1${obfuscationString} `);
};
/**
 * one tun command:
 * vpn/bin-wireguard/onetun-linux-amd64 --private-key --endpoint-addr --endpoint-public-key --source-peer-ip --keep-alive 25 localhost:31252:22
 * The command will include all required endpoints, one per host detected
 * That's why I created one commonlogfile, because it's very difficult to detect the host which occurs error
 */
export const vpnConnect = async (
	endPointAddrIp: string, // infra server locale ipaddress
	endPointAddrPort: number, // infra server port
	endpointPublicKey: string, // infra server public key
	privateKey: string,
	hostsToInspect: HostsType[], // final server ip address:port
	sourcePeerIp: string, // ip provided to client by infra server
	toRun: boolean
): Promise<number> => {
	const localHost = "127.0.0.1";
	const command = [
		`--private-key`,
		`${privateKey}`,
		`--endpoint-addr`,
		`${endPointAddrIp}:${endPointAddrPort}`,
		`--endpoint-public-key`,
		`${endpointPublicKey}`,
		`--source-peer-ip`,
		`${sourcePeerIp}`,
		`--keep-alive`,
		"25",
	];
	const endPoints: string[] = [];
	for (let i = 0; i < hostsToInspect.length; i++) {
		if (!hostsToInspect[i].toPerformOverWireguardVpn) continue; // not concerned
		const vpnPortForwarder: number = await controlNodeGetTcpFreePort();
		hostsToInspect[
			i
		].toPerformOverWireguardVpn = `${localHost}:${vpnPortForwarder}`;
		logCommonEvent(
			`Creating endPoint for host: ${hostsToInspect[i].userInput}/${hostsToInspect[i].toPerform}`,
			false,
			prefixCommonLog
		);
		const finalEndPoint = /:\d+/.test(hostsToInspect[i].toPerform)
			? hostsToInspect[i].toPerform
			: `${hostsToInspect[i].toPerform}:22`;
		endPoints.push(`${localHost}:${vpnPortForwarder}:${finalEndPoint}`);
	}
	const onetunBinaryPath = getProcessEnvValue("OPS")
		? getProcessEnvValue("OPS")
		: process.cwd();
	const vpnCommand = `${onetunBinaryPath}/vpn/bin-wireguard/onetun`;
	if (endPoints.length) {
		// adding Endpoints to command parameters lines
		for (const endpoint of endPoints) {
			command.push(endpoint);
		}
		logCommonEvent(
			`command ${vpnCommand} ${obfuscateVpnShellCommand(command.join(" "))}`,
			false,
			prefixCommonLog
		);
	}

	if (endPoints.length && toRun) {
		const execSpawn: ChildProcessWithoutNullStreams = spawn(
			vpnCommand,
			command
		);
		logCommonEvent(
			`Adding Vpn connection to vpnsTable: ${endPointAddrIp}:${endPointAddrPort} port Forward: ${endPoints.join(
				" "
			)} pid:${execSpawn.pid}`,
			false,
			prefixCommonLog
		);
		execSpawn.stdout.on("data", (data: Buffer) => {
			logCommonEvent(
				`(pid:${execSpawn.pid}) - stdout: ${data.toString()}`,
				false,
				prefixCommonLog
			);
		});

		execSpawn.stderr.on("data", (data: Buffer) => {
			logCommonEvent(
				`(pid:${execSpawn.pid}) - stderr: ${data.toString()}`,
				false,
				prefixCommonLog
			);
		});

		execSpawn.on("error", (error: Error) => {
			logCommonEvent(
				`(pid:${execSpawn.pid}) - Error occurred: ${JSON.stringify(
					error,
					null,
					2
				)}`,
				false,
				prefixCommonLog
			);
		});
		execSpawn.on("exit", (code: number, signal: string) => {
			logCommonEvent(
				`(pid:${execSpawn.pid}) - exited with code:${code} and signal:${signal}`,
				false,
				prefixCommonLog
			);
		});
		return execSpawn.pid || 0;
	}
	return 0;
};

export const closeVpnConnection = (pid: number): string[] => {
	const logs: string[] = [];
	if (pid) {
		let message = `killing VPN process (PID: ${pid})`;
		logHostEvent("automation", message);
		process.kill(pid, "SIGTERM");
		message = `VPN process has been killed (PID: ${pid})`;
		logHostEvent("automation", message);
		if (process.stdout.clearLine) process.stdout.clearLine(0);
		if (!getProcessEnvValue("SILENTMODE") && !getProcessEnvValue("QUIETMODE")) {
			consoleLog(`[*] ${message}`, "green");
		}
	}
	return logs;
};
