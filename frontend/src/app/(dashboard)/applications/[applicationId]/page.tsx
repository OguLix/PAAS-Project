import { ApplicationDetail } from '@/features/applications/application-detail';

type ApplicationPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function ApplicationPage({ params }: ApplicationPageProps) {
  const { applicationId } = await params;
  return <ApplicationDetail applicationId={applicationId} />;
}
