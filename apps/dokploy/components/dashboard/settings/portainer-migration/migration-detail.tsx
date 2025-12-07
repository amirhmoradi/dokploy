import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Clock,
	Database,
	FileText,
	Globe,
	Info,
	Loader2,
	Package,
	Pause,
	Play,
	RefreshCw,
	Server,
	Users,
	XCircle,
} from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface MigrationDetailProps {
	migrationId: string;
	onBack: () => void;
}

const statusConfig: Record<
	string,
	{ label: string; color: string; icon: React.ReactNode }
> = {
	pending: {
		label: "Pending",
		color: "text-muted-foreground",
		icon: <Clock className="h-4 w-4" />,
	},
	in_progress: {
		label: "In Progress",
		color: "text-blue-500",
		icon: <Loader2 className="h-4 w-4 animate-spin" />,
	},
	completed: {
		label: "Completed",
		color: "text-green-500",
		icon: <CheckCircle2 className="h-4 w-4" />,
	},
	failed: {
		label: "Failed",
		color: "text-red-500",
		icon: <XCircle className="h-4 w-4" />,
	},
	skipped: {
		label: "Skipped",
		color: "text-yellow-500",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
};

const logLevelConfig: Record<
	string,
	{ color: string; icon: React.ReactNode; bgColor: string }
> = {
	info: {
		color: "text-blue-500",
		icon: <Info className="h-4 w-4" />,
		bgColor: "bg-blue-50",
	},
	warning: {
		color: "text-yellow-500",
		icon: <AlertTriangle className="h-4 w-4" />,
		bgColor: "bg-yellow-50",
	},
	error: {
		color: "text-red-500",
		icon: <AlertCircle className="h-4 w-4" />,
		bgColor: "bg-red-50",
	},
	debug: {
		color: "text-gray-500",
		icon: <FileText className="h-4 w-4" />,
		bgColor: "bg-gray-50",
	},
};

const itemTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
	endpoint: { label: "Server", icon: <Server className="h-4 w-4" /> },
	stack: { label: "Stack", icon: <Package className="h-4 w-4" /> },
	registry: { label: "Registry", icon: <Database className="h-4 w-4" /> },
	user: { label: "User", icon: <Users className="h-4 w-4" /> },
	team: { label: "Team", icon: <Users className="h-4 w-4" /> },
	environment_variable: { label: "Env Var", icon: <FileText className="h-4 w-4" /> },
	volume: { label: "Volume", icon: <Database className="h-4 w-4" /> },
	network: { label: "Network", icon: <Globe className="h-4 w-4" /> },
};

export function MigrationDetail({ migrationId, onBack }: MigrationDetailProps) {
	const [activeTab, setActiveTab] = useState("overview");
	const [logFilter, setLogFilter] = useState<string | undefined>(undefined);

	const { data: migration, isLoading, refetch } = api.portainerMigration.one.useQuery(
		{ migrationId },
		{ refetchInterval: migration?.status === "running" ? 2000 : false },
	);

	const { data: logs, refetch: refetchLogs } = api.portainerMigration.logs.useQuery(
		{ migrationId, limit: 200, level: logFilter },
		{ refetchInterval: migration?.status === "running" ? 2000 : false },
	);

	const { data: items, refetch: refetchItems } = api.portainerMigration.items.useQuery(
		{ migrationId },
		{ refetchInterval: migration?.status === "running" ? 2000 : false },
	);

	const { data: stats } = api.portainerMigration.statistics.useQuery(
		{ migrationId },
		{ refetchInterval: migration?.status === "running" ? 2000 : false },
	);

	const cancelMutation = api.portainerMigration.cancel.useMutation();
	const executeMutation = api.portainerMigration.execute.useMutation();
	const retryItemMutation = api.portainerMigration.retryItem.useMutation();

	const handleCancel = async () => {
		try {
			await cancelMutation.mutateAsync({ migrationId });
			toast.success("Migration cancelled");
			refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel");
		}
	};

	const handleExecute = async (isDryRun: boolean) => {
		try {
			await executeMutation.mutateAsync({ migrationId, isDryRun });
			toast.success(isDryRun ? "Dry run started" : "Migration started");
			refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to start");
		}
	};

	const handleRetryItem = async (itemId: string) => {
		try {
			await retryItemMutation.mutateAsync({ itemId });
			toast.success("Item queued for retry");
			refetchItems();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to retry");
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin" />
				</CardContent>
			</Card>
		);
	}

	if (!migration) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12 gap-4">
					<AlertCircle className="h-12 w-12 text-muted-foreground" />
					<p>Migration not found</p>
					<Button variant="outline" onClick={onBack}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
				</CardContent>
			</Card>
		);
	}

	const migrationStatus = statusConfig[migration.status] || statusConfig.pending;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="outline" size="sm" onClick={onBack}>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div>
						<h2 className="text-2xl font-bold">{migration.name}</h2>
						{migration.description && (
							<p className="text-muted-foreground">{migration.description}</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Badge
						variant={
							migration.status === "completed"
								? "default"
								: migration.status === "failed"
									? "destructive"
									: "secondary"
						}
						className="flex items-center gap-1"
					>
						{migrationStatus.icon}
						{migrationStatus.label}
					</Badge>

					{migration.status === "ready" && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleExecute(true)}
								disabled={executeMutation.isPending}
							>
								<Play className="mr-2 h-4 w-4" />
								Dry Run
							</Button>
							<Button
								size="sm"
								onClick={() => handleExecute(false)}
								disabled={executeMutation.isPending}
							>
								<Play className="mr-2 h-4 w-4" />
								Execute
							</Button>
						</>
					)}

					{(migration.status === "running" || migration.status === "analyzing") && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancel}
							disabled={cancelMutation.isPending}
						>
							<Pause className="mr-2 h-4 w-4" />
							Cancel
						</Button>
					)}
				</div>
			</div>

			{/* Progress bar for running migrations */}
			{(migration.status === "running" || migration.status === "analyzing") && (
				<Card>
					<CardContent className="pt-6">
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span>{migration.currentStep || "Processing..."}</span>
								<span>{migration.progress}%</span>
							</div>
							<Progress value={migration.progress} />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Error message */}
			{migration.errorMessage && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{migration.errorMessage}</AlertDescription>
				</Alert>
			)}

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="items">
						Items {stats ? `(${stats.total})` : ""}
					</TabsTrigger>
					<TabsTrigger value="logs">Logs</TabsTrigger>
					<TabsTrigger value="analysis">Analysis</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						{/* Migration Info */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Configuration</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-muted-foreground">Source Type</span>
										<div className="flex items-center gap-2 mt-1">
											{migration.sourceType === "api" ? (
												<Globe className="h-4 w-4" />
											) : (
												<Database className="h-4 w-4" />
											)}
											{migration.sourceType === "api" ? "API" : "BoltDB"}
										</div>
									</div>
									<div>
										<span className="text-muted-foreground">Created</span>
										<p className="mt-1">
											{format(new Date(migration.createdAt), "PPp")}
										</p>
									</div>
									{migration.startedAt && (
										<div>
											<span className="text-muted-foreground">Started</span>
											<p className="mt-1">
												{format(new Date(migration.startedAt), "PPp")}
											</p>
										</div>
									)}
									{migration.completedAt && (
										<div>
											<span className="text-muted-foreground">Completed</span>
											<p className="mt-1">
												{format(new Date(migration.completedAt), "PPp")}
											</p>
										</div>
									)}
								</div>

								<div className="space-y-2">
									<span className="text-muted-foreground text-sm">
										Migration Options
									</span>
									<div className="flex flex-wrap gap-2">
										{migration.migrateStacks && (
											<Badge variant="outline">Stacks</Badge>
										)}
										{migration.migrateRegistries && (
											<Badge variant="outline">Registries</Badge>
										)}
										{migration.migrateEndpoints && (
											<Badge variant="outline">Endpoints</Badge>
										)}
										{migration.migrateUsers && (
											<Badge variant="outline">Users</Badge>
										)}
										{migration.isDryRun && (
											<Badge variant="secondary">Dry Run</Badge>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Statistics */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Statistics</CardTitle>
							</CardHeader>
							<CardContent>
								{stats ? (
									<div className="grid grid-cols-3 gap-4">
										<div className="text-center p-4 rounded-lg bg-muted/50">
											<div className="text-2xl font-bold">{stats.total}</div>
											<div className="text-sm text-muted-foreground">
												Total Items
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-green-50">
											<div className="text-2xl font-bold text-green-600">
												{stats.completed}
											</div>
											<div className="text-sm text-muted-foreground">
												Completed
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-red-50">
											<div className="text-2xl font-bold text-red-600">
												{stats.failed}
											</div>
											<div className="text-sm text-muted-foreground">
												Failed
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-yellow-50">
											<div className="text-2xl font-bold text-yellow-600">
												{stats.skipped}
											</div>
											<div className="text-sm text-muted-foreground">
												Skipped
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-blue-50">
											<div className="text-2xl font-bold text-blue-600">
												{stats.inProgress}
											</div>
											<div className="text-sm text-muted-foreground">
												In Progress
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-muted/50">
											<div className="text-2xl font-bold">{stats.pending}</div>
											<div className="text-sm text-muted-foreground">
												Pending
											</div>
										</div>
									</div>
								) : (
									<div className="flex items-center justify-center py-8">
										<Loader2 className="h-8 w-8 animate-spin" />
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Items Tab */}
				<TabsContent value="items">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-lg">Migration Items</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchItems()}
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{items && items.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Type</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Dokploy ID</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{items.map((item) => {
											const itemType = itemTypeConfig[item.itemType] || {
												label: item.itemType,
												icon: <FileText className="h-4 w-4" />,
											};
											const status = statusConfig[item.status] || statusConfig.pending;
											return (
												<TableRow key={item.itemId}>
													<TableCell>
														<div className="flex items-center gap-2">
															{itemType.icon}
															{itemType.label}
														</div>
													</TableCell>
													<TableCell>
														<div>
															<div className="font-medium">
																{item.portainerName}
															</div>
															<div className="text-xs text-muted-foreground">
																ID: {item.portainerId}
															</div>
														</div>
													</TableCell>
													<TableCell>
														<div
															className={`flex items-center gap-1 ${status.color}`}
														>
															{status.icon}
															{status.label}
														</div>
														{item.errorMessage && (
															<div className="text-xs text-red-500 mt-1">
																{item.errorMessage}
															</div>
														)}
													</TableCell>
													<TableCell>
														{item.dokployId ? (
															<code className="text-xs bg-muted px-2 py-1 rounded">
																{item.dokployId}
															</code>
														) : (
															<span className="text-muted-foreground">
																-
															</span>
														)}
													</TableCell>
													<TableCell>
														{item.status === "failed" && (
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleRetryItem(item.itemId)
																}
																disabled={retryItemMutation.isPending}
															>
																<RefreshCw className="h-4 w-4" />
															</Button>
														)}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									No items to display
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Logs Tab */}
				<TabsContent value="logs">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-lg">Migration Logs</CardTitle>
								<div className="flex items-center gap-2">
									<select
										className="text-sm border rounded px-2 py-1"
										value={logFilter || ""}
										onChange={(e) =>
											setLogFilter(e.target.value || undefined)
										}
									>
										<option value="">All Levels</option>
										<option value="info">Info</option>
										<option value="warning">Warning</option>
										<option value="error">Error</option>
										<option value="debug">Debug</option>
									</select>
									<Button
										variant="outline"
										size="sm"
										onClick={() => refetchLogs()}
									>
										<RefreshCw className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[500px]">
								{logs && logs.length > 0 ? (
									<div className="space-y-2">
										{logs.map((log) => {
											const levelConfig = logLevelConfig[log.level] || logLevelConfig.info;
											return (
												<div
													key={log.logId}
													className={`p-3 rounded-lg ${levelConfig.bgColor} dark:bg-opacity-10`}
												>
													<div className="flex items-start gap-3">
														<div className={levelConfig.color}>
															{levelConfig.icon}
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center justify-between gap-2">
																<span className="font-medium text-sm">
																	{log.message}
																</span>
																<span className="text-xs text-muted-foreground whitespace-nowrap">
																	{format(
																		new Date(log.timestamp),
																		"HH:mm:ss",
																	)}
																</span>
															</div>
															{log.itemName && (
																<div className="text-xs text-muted-foreground mt-1">
																	{log.itemType}: {log.itemName}
																</div>
															)}
															{log.details && (
																<pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto">
																	{JSON.stringify(
																		log.details,
																		null,
																		2,
																	)}
																</pre>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										No logs to display
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Analysis Tab */}
				<TabsContent value="analysis">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Analysis Results</CardTitle>
							<CardDescription>
								Overview of the analyzed Portainer data
							</CardDescription>
						</CardHeader>
						<CardContent>
							{migration.analysisResult ? (
								<div className="space-y-6">
									{/* Summary */}
									<div className="grid grid-cols-5 gap-4">
										<div className="text-center p-4 rounded-lg bg-blue-50">
											<Server className="h-8 w-8 mx-auto mb-2 text-blue-500" />
											<div className="text-2xl font-bold">
												{migration.analysisResult.summary.totalEndpoints}
											</div>
											<div className="text-sm text-muted-foreground">
												Endpoints
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-green-50">
											<Package className="h-8 w-8 mx-auto mb-2 text-green-500" />
											<div className="text-2xl font-bold">
												{migration.analysisResult.summary.totalStacks}
											</div>
											<div className="text-sm text-muted-foreground">
												Stacks
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-purple-50">
											<Database className="h-8 w-8 mx-auto mb-2 text-purple-500" />
											<div className="text-2xl font-bold">
												{migration.analysisResult.summary.totalRegistries}
											</div>
											<div className="text-sm text-muted-foreground">
												Registries
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-orange-50">
											<Users className="h-8 w-8 mx-auto mb-2 text-orange-500" />
											<div className="text-2xl font-bold">
												{migration.analysisResult.summary.totalUsers}
											</div>
											<div className="text-sm text-muted-foreground">
												Users
											</div>
										</div>
										<div className="text-center p-4 rounded-lg bg-emerald-50">
											<CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
											<div className="text-2xl font-bold">
												{migration.analysisResult.summary.migratable.stacks}
											</div>
											<div className="text-sm text-muted-foreground">
												Migratable
											</div>
										</div>
									</div>

									{/* Warnings */}
									{migration.analysisResult.summary.warnings.length > 0 && (
										<Alert variant="default">
											<AlertTriangle className="h-4 w-4" />
											<AlertTitle>Warnings</AlertTitle>
											<AlertDescription>
												<ul className="list-disc list-inside mt-2 space-y-1">
													{migration.analysisResult.summary.warnings.map(
														(warning, i) => (
															<li key={i} className="text-sm">
																{warning}
															</li>
														),
													)}
												</ul>
											</AlertDescription>
										</Alert>
									)}

									{/* Errors */}
									{migration.analysisResult.summary.errors.length > 0 && (
										<Alert variant="destructive">
											<AlertCircle className="h-4 w-4" />
											<AlertTitle>Issues Found</AlertTitle>
											<AlertDescription>
												<ul className="list-disc list-inside mt-2 space-y-1">
													{migration.analysisResult.summary.errors.map(
														(error, i) => (
															<li key={i} className="text-sm">
																{error}
															</li>
														),
													)}
												</ul>
											</AlertDescription>
										</Alert>
									)}

									{/* Stacks List */}
									{migration.analysisResult.stacks.length > 0 && (
										<div>
											<h4 className="font-medium mb-3">Stacks</h4>
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Name</TableHead>
														<TableHead>Type</TableHead>
														<TableHead>Can Migrate</TableHead>
														<TableHead>Notes</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{migration.analysisResult.stacks.map((stack) => (
														<TableRow key={stack.id}>
															<TableCell className="font-medium">
																{stack.name}
															</TableCell>
															<TableCell>
																{stack.type === 1
																	? "Swarm"
																	: stack.type === 2
																		? "Compose"
																		: "Kubernetes"}
															</TableCell>
															<TableCell>
																{stack.canMigrate ? (
																	<Badge
																		variant="default"
																		className="bg-green-500"
																	>
																		Yes
																	</Badge>
																) : (
																	<Badge variant="destructive">
																		No
																	</Badge>
																)}
															</TableCell>
															<TableCell>
																<div className="text-sm">
																	{stack.migrationNotes.join(", ")}
																</div>
																{stack.warnings.length > 0 && (
																	<div className="text-xs text-yellow-600 mt-1">
																		{stack.warnings.join(", ")}
																	</div>
																)}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									)}
								</div>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									No analysis data available. Run an analysis first.
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
