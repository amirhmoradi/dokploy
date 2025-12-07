import { useState } from "react";
import { MigrationList } from "./migration-list";
import { MigrationWizard } from "./migration-wizard";
import { MigrationDetail } from "./migration-detail";

type View = "list" | "create" | "detail";

export function PortainerMigration() {
	const [view, setView] = useState<View>("list");
	const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null);

	const handleCreateNew = () => {
		setView("create");
		setSelectedMigrationId(null);
	};

	const handleViewDetails = (migrationId: string) => {
		setSelectedMigrationId(migrationId);
		setView("detail");
	};

	const handleBack = () => {
		setView("list");
		setSelectedMigrationId(null);
	};

	return (
		<div className="space-y-6">
			{view === "list" && (
				<MigrationList
					onCreateNew={handleCreateNew}
					onViewDetails={handleViewDetails}
				/>
			)}

			{view === "create" && (
				<MigrationWizard onComplete={handleBack} onCancel={handleBack} />
			)}

			{view === "detail" && selectedMigrationId && (
				<MigrationDetail migrationId={selectedMigrationId} onBack={handleBack} />
			)}
		</div>
	);
}

export { MigrationList } from "./migration-list";
export { MigrationWizard } from "./migration-wizard";
export { MigrationDetail } from "./migration-detail";
