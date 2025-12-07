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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	CheckCircle2,
	Clock,
	Database,
	Eye,
	Globe,
	Loader2,
	MoreHorizontal,
	Play,
	Plus,
	RefreshCw,
	Trash2,
	XCircle,
	AlertCircle,
	Pause,
} from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MigrationListProps {
	onCreateNew: () => void;
	onViewDetails: (migrationId: string) => void;
}

const statusConfig: Record<
	string,
	{ label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
	pending: {
		label: "Pending",
		variant: "secondary",
		icon: <Clock className="h-3 w-3" />,
	},
	analyzing: {
		label: "Analyzing",
		variant: "default",
		icon: <Loader2 className="h-3 w-3 animate-spin" />,
	},
	ready: {
		label: "Ready",
		variant: "outline",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	running: {
		label: "Running",
		variant: "default",
		icon: <Loader2 className="h-3 w-3 animate-spin" />,
	},
	completed: {
		label: "Completed",
		variant: "default",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	failed: {
		label: "Failed",
		variant: "destructive",
		icon: <XCircle className="h-3 w-3" />,
	},
	cancelled: {
		label: "Cancelled",
		variant: "secondary",
		icon: <Pause className="h-3 w-3" />,
	},
};

export function MigrationList({ onCreateNew, onViewDetails }: MigrationListProps) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null);

	const { data: migrations, isLoading, refetch } = api.portainerMigration.all.useQuery();
	const deleteMutation = api.portainerMigration.delete.useMutation();
	const cancelMutation = api.portainerMigration.cancel.useMutation();
	const executeMutation = api.portainerMigration.execute.useMutation();

	const handleDelete = async () => {
		if (!selectedMigrationId) return;

		try {
			await deleteMutation.mutateAsync({ migrationId: selectedMigrationId });
			toast.success("Migration deleted");
			refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete migration");
		} finally {
			setDeleteDialogOpen(false);
			setSelectedMigrationId(null);
		}
	};

	const handleCancel = async (migrationId: string) => {
		try {
			await cancelMutation.mutateAsync({ migrationId });
			toast.success("Migration cancelled");
			refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel migration");
		}
	};

	const handleResume = async (migrationId: string, isDryRun: boolean) => {
		try {
			await executeMutation.mutateAsync({ migrationId, isDryRun });
			toast.success(isDryRun ? "Dry run started" : "Migration resumed");
			refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to resume migration");
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

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Portainer Migrations
							</CardTitle>
							<CardDescription>
								Migrate your Portainer stacks, registries, and configurations to Dokploy
							</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								<RefreshCw className="h-4 w-4" />
							</Button>
							<Button onClick={onCreateNew}>
								<Plus className="mr-2 h-4 w-4" />
								New Migration
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{migrations && migrations.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Source</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-[50px]"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{migrations.map((migration) => {
									const status = statusConfig[migration.status] || statusConfig.pending;
									return (
										<TableRow key={migration.migrationId}>
											<TableCell>
												<div className="font-medium">{migration.name}</div>
												{migration.description && (
													<div className="text-sm text-muted-foreground truncate max-w-xs">
														{migration.description}
													</div>
												)}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													{migration.sourceType === "api" ? (
														<Globe className="h-4 w-4" />
													) : (
														<Database className="h-4 w-4" />
													)}
													<span className="capitalize">
														{migration.sourceType === "api"
															? "API"
															: "BoltDB"}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant={status.variant}
													className="flex items-center gap-1 w-fit"
												>
													{status.icon}
													{status.label}
												</Badge>
											</TableCell>
											<TableCell>
												{migration.status === "running" ||
												migration.status === "analyzing" ? (
													<div className="flex items-center gap-2">
														<div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
															<div
																className="h-full bg-primary transition-all"
																style={{
																	width: `${migration.progress}%`,
																}}
															/>
														</div>
														<span className="text-sm">
															{migration.progress}%
														</span>
													</div>
												) : migration.status === "completed" ? (
													<span className="text-sm text-green-600">
														100%
													</span>
												) : (
													<span className="text-sm text-muted-foreground">
														-
													</span>
												)}
											</TableCell>
											<TableCell>
												<span className="text-sm text-muted-foreground">
													{formatDistanceToNow(
														new Date(migration.createdAt),
														{ addSuffix: true },
													)}
												</span>
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon">
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() =>
																onViewDetails(migration.migrationId)
															}
														>
															<Eye className="mr-2 h-4 w-4" />
															View Details
														</DropdownMenuItem>

														{migration.status === "ready" && (
															<>
																<DropdownMenuItem
																	onClick={() =>
																		handleResume(
																			migration.migrationId,
																			true,
																		)
																	}
																>
																	<Play className="mr-2 h-4 w-4" />
																	Run Dry Run
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		handleResume(
																			migration.migrationId,
																			false,
																		)
																	}
																>
																	<Play className="mr-2 h-4 w-4" />
																	Execute Migration
																</DropdownMenuItem>
															</>
														)}

														{(migration.status === "running" ||
															migration.status === "analyzing") && (
															<DropdownMenuItem
																onClick={() =>
																	handleCancel(migration.migrationId)
																}
															>
																<Pause className="mr-2 h-4 w-4" />
																Cancel
															</DropdownMenuItem>
														)}

														<DropdownMenuSeparator />

														<DropdownMenuItem
															onClick={() => {
																setSelectedMigrationId(
																	migration.migrationId,
																);
																setDeleteDialogOpen(true);
															}}
															className="text-destructive"
															disabled={
																migration.status === "running" ||
																migration.status === "analyzing"
															}
														>
															<Trash2 className="mr-2 h-4 w-4" />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					) : (
						<div className="text-center py-12 space-y-4">
							<Database className="h-12 w-12 mx-auto text-muted-foreground" />
							<div>
								<h3 className="font-medium">No migrations yet</h3>
								<p className="text-sm text-muted-foreground">
									Create your first migration to start moving from Portainer to
									Dokploy
								</p>
							</div>
							<Button onClick={onCreateNew}>
								<Plus className="mr-2 h-4 w-4" />
								Create Migration
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Migration</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this migration? This will remove all
							migration logs and history. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 h-4 w-4" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
