<script>
	import { page } from "$app/stores";
	import { onMount, onDestroy } from "svelte";
	import Badge from "@temporalio/ui/holocene/badge.svelte";
	import Loading from "@temporalio/ui/holocene/loading.svelte";
	import PageTitle from "@temporalio/ui/components/page-title.svelte";
	import Button from "@temporalio/ui/holocene/button.svelte";
	import githubMark from "../github-mark.svg";

	console.log("API url grabbed from .env: ", import.meta.env.VITE_API_URL);
	const API_URL = import.meta.env.VITE_API_URL;

	function navigateToRoot() {
		window.location.href = "/";
	}

	let fromAccount = "Checking";
	let toAccount = "";
	let amount = 1;
	let transferSubmitted = false;
	let scheduleTransferSubmitted = false;
	let transferId = "";
	let transferState = "";
	let serverinfo = "";
	let workflowOutcome = null;
	let progressPercentage = 0;
	let chargeId = "";
	let failed = false;
	let waiting = false;
	let scheduleTransfer = false; // New state for the checkbox
	let scheduleInterval = "15"; // Time interval in seconds
	let scheduleCount = "3"; // Number of times to run the transfer
	const fromAccounts = ["Checking", "Savings"];
	const toAccounts = [
		"Justine Morris",
		"Raul Ruidíaz",
		"Ian Wu",
		"Emma Stockton",
	];

	let apiUrl = API_URL;
	// if API_URL is undefined set to ""
	if (API_URL === undefined) {
		apiUrl = "";
	}

	let scenario = "HAPPY_PATH";
	const scenarios = [
		{ label: 'Normal "Happy Path" Execution', value: "HAPPY_PATH" },
		{ label: "Require Human-In-Loop Approval", value: "HUMAN_IN_LOOP" },
		{
			label: "API Downtime (recover on 5th attempt)",
			value: "API_DOWNTIME",
		},
		{
			label: "Bug in Workflow (recoverable failure)",
			value: "BUG_IN_WORKFLOW",
		},
		{
			label: "Invalid Account (unrecoverable failure)",
			value: "INVALID_ACCOUNT",
		},
	];

	let workflowStatuses = [];

	async function transferMoney() {
		if (scheduleTransfer) {
			// Handle scheduled transfers
			console.log(
				`scheduling regular transfers every ${scheduleInterval} seconds, ${scheduleCount} times`
			);
			const res = await fetch(`${apiUrl}/scheduleWorkflow`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					amount: amount,
					scenario: scenario,
					interval: scheduleInterval,
					count: scheduleCount,
				}),
			});
			const data = await res.json();
			console.log(data);
			transferSubmitted = true;
			scheduleTransferSubmitted = true;
			transferId = data.transferId; // Assuming the response contains a transferId
		} else {
			// Existing one-time transfer logic
			console.log(`transferring $${amount}`);

			const res = await fetch(`${apiUrl}/runWorkflow`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					amount: amount,
					scenario: scenario,
				}),
			});
			const data = await res.json();
			console.log(data);
			transferSubmitted = true;
			transferId = data.transferId;
		}
	}

	async function approveTransfer() {
		// Existing one-time transfer logic
		console.log(`approving $${transferId}`);

		const res = await fetch(`${apiUrl}/approveTransfer`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workflowId: transferId
			}),
		});
		const data = await res.json();
		console.log(data);
	}

	async function getWorkflowState() {
		const res = await fetch(`${apiUrl}/runQuery`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workflowId: transferId,
			}),
		});

		// fetch from runQuery with workflowId

		const data = await res.json();
		return data;
		// alert(`Transferring $${amount} from ${fromAccount} to ${toAccount}.`);
	}

	async function getServerInfo() {
		const res = await fetch(`${apiUrl}/serverinfo`, {
			method: "GET",
		});

		const data = await res.json();
		return data;
	}

	// Unused function to get reason for workflow failure
	async function getWorkflowOutcome() {
		const res = await fetch(`${apiUrl}/getWorkflowOutcome`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workflowId: transferId,
			}),
		});

		// fetch from runQuery with workflowId

		const data = await res.json();
		return data;
		// alert(`Transferring $${amount} from ${fromAccount} to ${toAccount}.`);
	}

	async function listWorkflows() {
		const res = await fetch(`${apiUrl}/listWorkflows`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		// fetch from runQuery with workflowId

		const data = await res.json();
		return data;
	}

	let approvalTime = 0; // Set this to the actual approval time
	let countdown = formatTime(approvalTime);

	// Function to format time in MM:SS format
	function formatTime(seconds) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}

	onMount(async () => {
		serverinfo = await getServerInfo();

		const intervalId = setInterval(async () => {
			const workflowStatusesCall = await listWorkflows();
			workflowStatuses = workflowStatusesCall;

			if (scheduleTransferSubmitted) {
				return;
			}

			if (transferId === "") {
				return;
			}
			if (transferState.transferState === "running") {
				waiting = false;
			}
			if (transferState.transferState === "finished" || failed) {
				waiting = false;
				return;
			}
			if (transferState.transferState === "waiting") {
				if(!waiting) {
					approvalTime = transferState.approvalTime;
					countdown = formatTime(approvalTime);
					waiting = true;
				}
				countdown = formatTime(approvalTime);
				approvalTime--;

				if (approvalTime < 0) {
					countdown = "0:00";
				}
			}
			if (transferState.workflowStatus === "FAILED") {
				waiting = false;
				failed = true;
				return;
			}

			transferState = await getWorkflowState();

			progressPercentage = transferState.progressPercentage;
			chargeId = transferState.chargeResult.chargeId;
			console.log("transferState: ", transferState);

		}, 1000);

		return () => {
			clearInterval(intervalId);
			clearInterval(timerIntervalId);
		};
	});
</script>

<PageTitle title="Money Transfer App" url={$page.url.href} />
<section class="flex flex-col gap-8 items-center">
	<Loading title="" on:click={navigateToRoot} />
	<h2 class="text-2xl flex items-center gap-1">Transfer Money</h2>
	{#if !transferSubmitted}
		<div class="sm:w-1/2 w-full border border-gray-200 p-4 rounded-md">
			<label
				for="from-account"
				class="block text-sm font-medium text-gray-700"
				>From Account</label
			>
			<select
				id="from-account"
				bind:value={fromAccount}
				class="mt-1 block w-full text-2xl"
			>
				{#each fromAccounts as account (account)}
					<option>{account}</option>
				{/each}
			</select>
		</div>
		<div class="sm:w-1/2 w-full border border-gray-200 p-4 rounded-md">
			<label
				for="to-account"
				class="block text-sm font-medium text-gray-700"
				>To Account</label
			>
			<select
				id="to-account"
				bind:value={toAccount}
				class="mt-1 block w-full text-2xl"
			>
				{#each toAccounts as account (account)}
					<option>{account}</option>
				{/each}
			</select>
		</div>
		<div class="sm:w-1/2 w-full border border-gray-200 p-4 rounded-md">
			<label for="amount" class="block text-sm font-medium text-gray-700"
				>Amount (In USD)</label
			>
			<input
				id="amount"
				type="number"
				bind:value={amount}
				class="mt-1 block w-full text-4xl"
			/>
		</div>
		<div class="sm:w-1/2 w-full border border-gray-200 p-4 rounded-md">
			<label
				for="simulate"
				class="block text-sm font-medium text-gray-400"
				>Debug: Simulate</label
			>
			<select
				id="simulate"
				bind:value={scenario}
				class="mt-1 block w-full text-2xl"
			>
				{#each scenarios as scenarioObj (scenarioObj.value)}
					<option value={scenarioObj.value}
						>{scenarioObj.label}</option
					>
				{/each}
			</select>
		</div>
		<div>
			<input
				type="checkbox"
				id="schedule-checkbox"
				style="transform: scale(1.6); vertical-align: middle; margin-right:6px"
				bind:checked={scheduleTransfer}
			/>
			<label style="font-size: 1.0em;" for="schedule-checkbox"
				>Schedule a recurring transfer</label
			>
		</div>
		{#if scheduleTransfer}
			<div style="font-size: 1.5em;">
				<span>Schedule this transfer every </span>
				<input
					type="number"
					bind:value={scheduleInterval}
					placeholder="n"
					style="width: 50px; text-align: center; background-color: lightgrey;"
				/>
				<span> seconds, and run it</span>
				<input
					type="number"
					bind:value={scheduleCount}
					placeholder="n"
					style="width: 50px; text-align: center; background-color: lightgrey;"
				/>
				<span> times</span>
			</div>
		{/if}
		<div class="">
			<Button on:click={transferMoney}>Transfer</Button>
		</div>
	{:else if scheduleTransferSubmitted}
		<h2 class="text-2xl font-bold text-gray-700">
			Transfer Schedule Submitted
		</h2>
		<h3>
			{transferId}
		</h3>
	{:else}
		<div
			class="sm:w-1/2 w-full mx-auto mt-10 bg-white shadow-lg rounded-lg overflow-hidden"
		>
			<div class="py-4 px-6">
				<h2 class="text-2xl font-bold text-gray-700">Submitted</h2>
				<p class="py-2 text-gray-700 font-semibold">
					From: <span class="font-normal">{fromAccount}</span>
				</p>
				<p class="py-2 text-gray-700 font-semibold">
					To: <span class="font-normal">{toAccount}</span>
				</p>
				<p class="py-2 text-gray-700 font-semibold">
					Amount: <span class="font-normal">${amount}</span>
				</p>
			</div>
			<div class="py-4 px-6">
				{#if failed}
					<p class="text-red-500 font-semibold">
						Transfer failed. Please try again later.
					</p>
					<!-- <p class="text-gray-400 text-sm">
						Confirmation: {chargeId}
					</p> -->
				{:else if waiting}
					<p class="text-orange-500 font-semibold">
						Approval required.

						Transfer expiry in {countdown}

					</p>
				{:else if progressPercentage === 100}
					<p class="text-green-500 font-semibold">
						Transfer complete!
					</p>
					<p class="text-gray-400 text-sm">
						Confirmation: {chargeId}
					</p>
				{:else if progressPercentage < 100}
					<p class="text-lightgrey-500 font-semibold">
						Transfer Progress: {progressPercentage}%
					</p>

					<div class="progress-bar">
						<div
							class="progress"
							style="width: {progressPercentage}%;"
						/>
					</div>
				{/if}
			</div>
			<div class="px-6 py-3 bg-gray-100 text-right">
				<p class="text-gray-400 text-sm">{transferId}</p>
			</div>
		</div>
	{/if}
	<br />
	<!-- list workflows -->
	<h2>Transfer History (1h)</h2>
	<table class="w-full md:w-1/2 leading-normal mx-auto">
		<thead>
			<tr>
				<th
					class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
					>Workflow ID</th
				>
				<th
					class="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
					>Status</th
				>
			</tr>
		</thead>
		<tbody>
			{#each workflowStatuses as status}
				<tr
					class:bg-lightPurple={transferId &&
						status.workflowId &&
						status.workflowId.startsWith(transferId)}
					class="transition duration-300 ease-in-out hover:bg-gray-100"
				>
					<td class="px-5 py-5 border-b border-gray-200 text-sm">
						{#if status.url}
							<a href={status.url} target="_blank"
								>{status.workflowId}</a
							>
						{:else}
							{status.workflowId}
						{/if}
					</td>
					<td class="px-5 py-5 border-b border-gray-200 text-sm">
						{status.workflowStatus}

						{#if transferId && status.workflowId && status.workflowId.startsWith(transferId) && waiting}
							<br />
							<Button on:click={approveTransfer}>Approve</Button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h6>
		<a
			href="https://github.com/steveandroulakis/temporal-money-transfer"
			target="_blank"
		>
			<img src={githubMark} alt="Source Code" class="w-8 h-auto" /></a
		>
	</h6>

	<div class="px-6 py-3 bg-gray-100 text-center">
		<p class="text-gray-400 text-sm">Temporal Server</p>
		{#if !serverinfo.url}
			<p class="text-gray-400 text-sm">
				{serverinfo.address}
			</p>
		{:else}
			<p class="text-gray-400 text-sm">
				<a target="_blank" href={serverinfo.url}>
					{serverinfo.address}
				</a>
			</p>
		{/if}
		<p class="text-gray-400 text-sm">Namespace: {serverinfo.namespace}</p>
	</div>
</section>
