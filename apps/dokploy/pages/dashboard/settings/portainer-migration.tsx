import { validateRequest } from "@dokploy/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { PortainerMigration } from "@/components/dashboard/settings/portainer-migration";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { getLocale, serverSideTranslations } from "@/utils/i18n";

const Page = () => {
	return (
		<div className="w-full">
			<div className="h-full rounded-xl max-w-6xl mx-auto flex flex-col gap-4">
				<div className="space-y-2">
					<h1 className="text-2xl font-bold">Portainer Migration</h1>
					<p className="text-muted-foreground">
						Migrate your Portainer stacks, registries, and configurations to Dokploy
					</p>
				</div>
				<PortainerMigration />
			</div>
		</div>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Portainer Migration">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
	const { req, res } = ctx;
	const locale = await getLocale(req.cookies);

	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}

	// Only admins and owners can access migration tool
	if (user.role === "member") {
		return {
			redirect: {
				permanent: true,
				destination: "/dashboard/settings/profile",
			},
		};
	}

	return {
		props: {
			...(await serverSideTranslations(locale, ["settings"])),
		},
	};
}
