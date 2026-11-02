import { DeploymentDetail } from '@/features/deployments/deployment-detail';

type DeploymentPageProps = {
  params: Promise<{ deploymentId: string }>;
};

export default async function DeploymentPage({ params }: DeploymentPageProps) {
  const { deploymentId } = await params;
  return <DeploymentDetail deploymentId={deploymentId} />;
}
