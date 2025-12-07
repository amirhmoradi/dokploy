import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCircle2,
	Database,
	FileJson,
	Globe,
	Key,
	Loader2,
	Package,
	Play,
	RefreshCw,
	Server,
	Settings,
	Upload,
	Users,
	XCircle,
} from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "sonner";

// Form schema for migration wizard
const migrationFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	sourceType: z.enum(["api", "boltdb"]),

	// API source
	portainerUrl: z.string().url().optional().or(z.literal("")),
	portainerApiKey: z.string().optional(),
	portainerUsername: z.string().optional(),
	portainerPassword: z.string().optional(),

	// BoltDB source
	boltDbPath: z.string().optional(),
	stackFilesPath: z.string().optional(),

	// Migration options
	isDryRun: z.boolean().default(true),
	migrateStacks: z.boolean().default(true),
	migrateRegistries: z.boolean().default(true),
	migrateUsers: z.boolean().default(false),
	migrateEndpoints: z.boolean().default(true),
	migrateEnvironmentVariables: z.boolean().default(true),
	autoDeployAfterMigration: z.boolean().default(false),

	// Target
	targetProjectId: z.string().optional(),
	targetEnvironmentId: z.string().optional(),
	targetServerId: z.string().optional(),
});

type MigrationFormValues = z.infer<typeof migrationFormSchema>;

interface MigrationWizardProps {
	onComplete?: () => void;
	onCancel?: () => void;
}

export function MigrationWizard({ onComplete, onCancel }: MigrationWizardProps) {
	const [step, setStep] = useState(1);
	const [migrationId, setMigrationId] = useState<string | null>(null);
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState<
		"idle" | "success" | "error"
	>("idle");
	const [connectionError, setConnectionError] = useState<string | null>(null);

	const form = useForm<MigrationFormValues>({
		resolver: zodResolver(migrationFormSchema),
		defaultValues: {
			name: "",
			description: "",
			sourceType: "api",
			portainerUrl: "",
			portainerApiKey: "",
			portainerUsername: "",
			portainerPassword: "",
			boltDbPath: "",
			stackFilesPath: "",
			isDryRun: true,
			migrateStacks: true,
			migrateRegistries: true,
			migrateUsers: false,
			migrateEndpoints: true,
			migrateEnvironmentVariables: true,
			autoDeployAfterMigration: false,
			targetProjectId: "",
			targetEnvironmentId: "",
			targetServerId: "",
		},
	});

	const sourceType = form.watch("sourceType");
	const targetProjectId = form.watch("targetProjectId");

	// API hooks
	const testConnection = api.portainerMigration.testConnection.useMutation();
	const createMigration = api.portainerMigration.create.useMutation();
	const analyzeMigration = api.portainerMigration.analyze.useMutation();
	const executeMigration = api.portainerMigration.execute.useMutation();

	const { data: projects } = api.portainerMigration.getProjects.useQuery();
	const { data: servers } = api.portainerMigration.getServers.useQuery();
	const { data: migration, refetch: refetchMigration } =
		api.portainerMigration.one.useQuery(
			{ migrationId: migrationId! },
			{ enabled: !!migrationId, refetchInterval: 2000 },
		);

	// Get environments for selected project
	const selectedProject = projects?.find((p) => p.projectId === targetProjectId);
	const environments = selectedProject?.environments || [];

	const handleTestConnection = async () => {
		const values = form.getValues();
		setIsTestingConnection(true);
		setConnectionStatus("idle");
		setConnectionError(null);

		try {
			const result = await testConnection.mutateAsync({
				sourceType: values.sourceType,
				portainerUrl: values.portainerUrl || undefined,
				portainerApiKey: values.portainerApiKey || undefined,
				portainerUsername: values.portainerUsername || undefined,
				portainerPassword: values.portainerPassword || undefined,
				boltDbPath: values.boltDbPath || undefined,
			});

			if (result.success) {
				setConnectionStatus("success");
				toast.success("Connection successful!");
			} else {
				setConnectionStatus("error");
				setConnectionError(result.error || "Connection failed");
				toast.error(result.error || "Connection failed");
			}
		} catch (error) {
			setConnectionStatus("error");
			setConnectionError(error instanceof Error ? error.message : "Connection failed");
			toast.error("Connection test failed");
		} finally {
			setIsTestingConnection(false);
		}
	};

	const handleCreateMigration = async () => {
		const values = form.getValues();

		try {
			const result = await createMigration.mutateAsync({
				name: values.name,
				description: values.description,
				sourceType: values.sourceType,
				portainerUrl: values.portainerUrl || undefined,
				portainerApiKey: values.portainerApiKey || undefined,
				portainerUsername: values.portainerUsername || undefined,
				portainerPassword: values.portainerPassword || undefined,
				boltDbPath: values.boltDbPath || undefined,
				stackFilesPath: values.stackFilesPath || undefined,
				isDryRun: values.isDryRun,
				migrateStacks: values.migrateStacks,
				migrateRegistries: values.migrateRegistries,
				migrateUsers: values.migrateUsers,
				migrateEndpoints: values.migrateEndpoints,
				migrateEnvironmentVariables: values.migrateEnvironmentVariables,
				autoDeployAfterMigration: values.autoDeployAfterMigration,
				targetProjectId: values.targetProjectId || undefined,
				targetEnvironmentId: values.targetEnvironmentId || undefined,
				targetServerId: values.targetServerId || undefined,
			});

			setMigrationId(result.migrationId);
			toast.success("Migration created successfully");
			setStep(4); // Move to analysis step
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create migration",
			);
		}
	};

	const handleAnalyze = async () => {
		if (!migrationId) return;

		try {
			await analyzeMigration.mutateAsync({ migrationId });
			toast.success("Analysis completed");
			await refetchMigration();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Analysis failed");
		}
	};

	const handleExecute = async (isDryRun: boolean) => {
		if (!migrationId) return;

		try {
			await executeMigration.mutateAsync({ migrationId, isDryRun });
			toast.success(isDryRun ? "Dry run started" : "Migration started");
			await refetchMigration();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Migration failed");
		}
	};

	const renderStepIndicator = () => (
		<div className="flex items-center justify-center gap-2 mb-8">
			{[1, 2, 3, 4, 5].map((s) => (
				<div key={s} className="flex items-center">
					<div
						className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
							step >= s
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{step > s ? <Check className="h-5 w-5" /> : s}
					</div>
					{s < 5 && (
						<div
							className={`w-12 h-1 ${step > s ? "bg-primary" : "bg-muted"}`}
						/>
					)}
				</div>
			))}
		</div>
	);

	const renderStep1 = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Settings className="h-5 w-5" />
					Step 1: Migration Details
				</CardTitle>
				<CardDescription>
					Configure the basic details for your Portainer migration
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Migration Name *</FormLabel>
							<FormControl>
								<Input
									placeholder="My Portainer Migration"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								A descriptive name for this migration
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Optional description of this migration..."
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Separator />

				<FormField
					control={form.control}
					name="sourceType"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Data Source</FormLabel>
							<FormControl>
								<RadioGroup
									onValueChange={field.onChange}
									defaultValue={field.value}
									className="grid grid-cols-2 gap-4"
								>
									<div className="relative">
										<RadioGroupItem
											value="api"
											id="api"
											className="peer sr-only"
										/>
										<label
											htmlFor="api"
											className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
										>
											<Globe className="mb-3 h-6 w-6" />
											<span className="font-medium">Portainer API</span>
											<span className="text-xs text-muted-foreground text-center mt-1">
												Connect to a running Portainer instance
											</span>
										</label>
									</div>
									<div className="relative">
										<RadioGroupItem
											value="boltdb"
											id="boltdb"
											className="peer sr-only"
										/>
										<label
											htmlFor="boltdb"
											className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
										>
											<Database className="mb-3 h-6 w-6" />
											<span className="font-medium">BoltDB File</span>
											<span className="text-xs text-muted-foreground text-center mt-1">
												Import from Portainer data directory
											</span>
										</label>
									</div>
								</RadioGroup>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</CardContent>
		</Card>
	);

	const renderStep2 = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{sourceType === "api" ? (
						<Globe className="h-5 w-5" />
					) : (
						<Database className="h-5 w-5" />
					)}
					Step 2: Source Configuration
				</CardTitle>
				<CardDescription>
					{sourceType === "api"
						? "Configure your Portainer API connection"
						: "Specify the path to your Portainer data files"}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{sourceType === "api" ? (
					<>
						<FormField
							control={form.control}
							name="portainerUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Portainer URL *</FormLabel>
									<FormControl>
										<Input
											placeholder="https://portainer.example.com"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										The URL of your Portainer instance
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Alert>
							<Key className="h-4 w-4" />
							<AlertTitle>Authentication</AlertTitle>
							<AlertDescription>
								You can use either an API key (recommended) or
								username/password authentication.
							</AlertDescription>
						</Alert>

						<FormField
							control={form.control}
							name="portainerApiKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API Key</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="ptr_xxxxxxxxxxxxx"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Generate an API key in Portainer Settings &gt; Access
										tokens
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="text-center text-sm text-muted-foreground">
							- or -
						</div>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="portainerUsername"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input placeholder="admin" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="portainerPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="********"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</>
				) : (
					<>
						<Alert>
							<FileJson className="h-4 w-4" />
							<AlertTitle>BoltDB File Location</AlertTitle>
							<AlertDescription>
								The portainer.db file is typically located at{" "}
								<code>/data/portainer.db</code> in your Portainer container.
							</AlertDescription>
						</Alert>

						<FormField
							control={form.control}
							name="boltDbPath"
							render={({ field }) => (
								<FormItem>
									<FormLabel>BoltDB File Path *</FormLabel>
									<FormControl>
										<Input
											placeholder="/path/to/portainer.db"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Path to the portainer.db file on this server
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="stackFilesPath"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Stack Files Path</FormLabel>
									<FormControl>
										<Input
											placeholder="/path/to/portainer/data"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Path to the Portainer data directory containing compose
										files (optional, but needed for stack content)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</>
				)}

				<Separator />

				<div className="flex items-center gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={handleTestConnection}
						disabled={isTestingConnection}
					>
						{isTestingConnection ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="mr-2 h-4 w-4" />
						)}
						Test Connection
					</Button>

					{connectionStatus === "success" && (
						<Badge variant="default" className="bg-green-500">
							<CheckCircle2 className="mr-1 h-3 w-3" />
							Connected
						</Badge>
					)}

					{connectionStatus === "error" && (
						<Badge variant="destructive">
							<XCircle className="mr-1 h-3 w-3" />
							Failed
						</Badge>
					)}
				</div>

				{connectionError && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Connection Error</AlertTitle>
						<AlertDescription>{connectionError}</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	);

	const renderStep3 = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Package className="h-5 w-5" />
					Step 3: Migration Options
				</CardTitle>
				<CardDescription>
					Select what data to migrate and configure target settings
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-4">
					<h4 className="font-medium">Data to Migrate</h4>

					<FormField
						control={form.control}
						name="migrateStacks"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Stacks (Docker Compose)</FormLabel>
									<FormDescription>
										Migrate all Docker Compose stacks
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="migrateRegistries"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Container Registries</FormLabel>
									<FormDescription>
										Migrate Docker registry configurations
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="migrateEndpoints"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Endpoints (as Servers)</FormLabel>
									<FormDescription>
										Migrate endpoints as Dokploy servers (requires SSH
										configuration)
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="migrateEnvironmentVariables"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Environment Variables</FormLabel>
									<FormDescription>
										Include environment variables in stack migration
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>
				</div>

				<Separator />

				<div className="space-y-4">
					<h4 className="font-medium">Target Configuration</h4>

					<FormField
						control={form.control}
						name="targetProjectId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Target Project</FormLabel>
								<Select
									onValueChange={field.onChange}
									defaultValue={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Create new project" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="">Create new project</SelectItem>
										{projects?.map((project) => (
											<SelectItem
												key={project.projectId}
												value={project.projectId}
											>
												{project.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormDescription>
									Select an existing project or create a new one
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					{targetProjectId && environments.length > 0 && (
						<FormField
							control={form.control}
							name="targetEnvironmentId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Target Environment</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select environment" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{environments.map((env) => (
												<SelectItem
													key={env.environmentId}
													value={env.environmentId}
												>
													{env.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<FormField
						control={form.control}
						name="targetServerId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Target Server</FormLabel>
								<Select
									onValueChange={field.onChange}
									defaultValue={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Use mapped servers" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="">Use mapped servers</SelectItem>
										{servers?.map((s) => (
											<SelectItem key={s.serverId} value={s.serverId}>
												{s.name} ({s.ipAddress})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormDescription>
									Override with a specific server or use endpoint mapping
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<Separator />

				<div className="space-y-4">
					<h4 className="font-medium">Execution Options</h4>

					<FormField
						control={form.control}
						name="isDryRun"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Dry Run (Recommended)</FormLabel>
									<FormDescription>
										Simulate migration without making changes
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="autoDeployAfterMigration"
						render={({ field }) => (
							<FormItem className="flex flex-row items-start space-x-3 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<div className="space-y-1 leading-none">
									<FormLabel>Auto-deploy After Migration</FormLabel>
									<FormDescription>
										Automatically deploy stacks after migration (not
										recommended for first run)
									</FormDescription>
								</div>
							</FormItem>
						)}
					/>
				</div>
			</CardContent>
		</Card>
	);

	const renderStep4 = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileJson className="h-5 w-5" />
					Step 4: Analysis
				</CardTitle>
				<CardDescription>
					Review the analysis of your Portainer data before migration
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{!migration ? (
					<div className="text-center py-8">
						<Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
						<p>Loading migration details...</p>
					</div>
				) : migration.status === "pending" ? (
					<div className="text-center py-8 space-y-4">
						<Database className="h-12 w-12 mx-auto text-muted-foreground" />
						<div>
							<h4 className="font-medium">Ready to Analyze</h4>
							<p className="text-sm text-muted-foreground">
								Click the button below to analyze your Portainer data
							</p>
						</div>
						<Button onClick={handleAnalyze} disabled={analyzeMigration.isPending}>
							{analyzeMigration.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Play className="mr-2 h-4 w-4" />
							)}
							Start Analysis
						</Button>
					</div>
				) : migration.status === "analyzing" ? (
					<div className="text-center py-8 space-y-4">
						<Loader2 className="h-12 w-12 animate-spin mx-auto" />
						<div>
							<h4 className="font-medium">Analyzing Portainer Data</h4>
							<p className="text-sm text-muted-foreground">
								{migration.currentStep || "Please wait..."}
							</p>
						</div>
						<Progress value={migration.progress} className="w-64 mx-auto" />
					</div>
				) : migration.analysisResult ? (
					<div className="space-y-6">
						{/* Summary */}
						<div className="grid grid-cols-5 gap-4">
							<Card>
								<CardContent className="pt-6 text-center">
									<Server className="h-8 w-8 mx-auto mb-2 text-blue-500" />
									<div className="text-2xl font-bold">
										{migration.analysisResult.summary.totalEndpoints}
									</div>
									<div className="text-sm text-muted-foreground">
										Endpoints
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<Package className="h-8 w-8 mx-auto mb-2 text-green-500" />
									<div className="text-2xl font-bold">
										{migration.analysisResult.summary.totalStacks}
									</div>
									<div className="text-sm text-muted-foreground">
										Stacks
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<Database className="h-8 w-8 mx-auto mb-2 text-purple-500" />
									<div className="text-2xl font-bold">
										{migration.analysisResult.summary.totalRegistries}
									</div>
									<div className="text-sm text-muted-foreground">
										Registries
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<Users className="h-8 w-8 mx-auto mb-2 text-orange-500" />
									<div className="text-2xl font-bold">
										{migration.analysisResult.summary.totalUsers}
									</div>
									<div className="text-sm text-muted-foreground">
										Users
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
									<div className="text-2xl font-bold">
										{migration.analysisResult.summary.migratable.stacks}
									</div>
									<div className="text-sm text-muted-foreground">
										Migratable
									</div>
								</CardContent>
							</Card>
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

						<div className="flex gap-4">
							<Button onClick={handleAnalyze} variant="outline">
								<RefreshCw className="mr-2 h-4 w-4" />
								Re-analyze
							</Button>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);

	const renderStep5 = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Play className="h-5 w-5" />
					Step 5: Execute Migration
				</CardTitle>
				<CardDescription>
					Review and execute your migration
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{migration?.status === "running" ? (
					<div className="text-center py-8 space-y-4">
						<Loader2 className="h-12 w-12 animate-spin mx-auto" />
						<div>
							<h4 className="font-medium">Migration in Progress</h4>
							<p className="text-sm text-muted-foreground">
								{migration.currentStep || "Processing..."}
							</p>
						</div>
						<Progress value={migration.progress} className="w-64 mx-auto" />
					</div>
				) : migration?.status === "completed" ? (
					<div className="text-center py-8 space-y-4">
						<CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
						<div>
							<h4 className="font-medium text-green-600">
								Migration Completed!
							</h4>
							<p className="text-sm text-muted-foreground">
								Your Portainer data has been successfully migrated to
								Dokploy
							</p>
						</div>
						<Button onClick={onComplete}>View Results</Button>
					</div>
				) : (
					<div className="space-y-6">
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Before You Start</AlertTitle>
							<AlertDescription>
								<ul className="list-disc list-inside mt-2 space-y-1">
									<li>
										We recommend running a dry run first to preview
										changes
									</li>
									<li>
										Migrated servers will require SSH key configuration
									</li>
									<li>
										Stacks will be created but not deployed automatically
										(unless enabled)
									</li>
								</ul>
							</AlertDescription>
						</Alert>

						<div className="flex gap-4 justify-center">
							<Button
								variant="outline"
								onClick={() => handleExecute(true)}
								disabled={executeMigration.isPending}
							>
								{executeMigration.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Play className="mr-2 h-4 w-4" />
								)}
								Run Dry Run
							</Button>
							<Button
								onClick={() => handleExecute(false)}
								disabled={executeMigration.isPending}
							>
								{executeMigration.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Play className="mr-2 h-4 w-4" />
								)}
								Start Migration
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);

	const canProceedToNext = () => {
		switch (step) {
			case 1:
				return form.watch("name").length > 0;
			case 2:
				return connectionStatus === "success";
			case 3:
				return true;
			case 4:
				return migration?.status === "ready" || migration?.status === "completed";
			default:
				return true;
		}
	};

	return (
		<Form {...form}>
			<form className="space-y-6">
				{renderStepIndicator()}

				{step === 1 && renderStep1()}
				{step === 2 && renderStep2()}
				{step === 3 && renderStep3()}
				{step === 4 && renderStep4()}
				{step === 5 && renderStep5()}

				<div className="flex justify-between">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							if (step > 1) {
								setStep(step - 1);
							} else {
								onCancel?.();
							}
						}}
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						{step === 1 ? "Cancel" : "Back"}
					</Button>

					{step < 5 && (
						<Button
							type="button"
							onClick={async () => {
								if (step === 3) {
									await handleCreateMigration();
								} else {
									setStep(step + 1);
								}
							}}
							disabled={!canProceedToNext() || createMigration.isPending}
						>
							{createMigration.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{step === 3 ? "Create & Analyze" : "Next"}
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
}
