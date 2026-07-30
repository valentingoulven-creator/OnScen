import { useAuth } from '../context/AuthContext';
import { ProfileSetupWizard } from '../components/ProfileSetupWizard';

interface Props {
  onDone: () => void;
}

export function OnboardingPage({ onDone }: Props) {
  const { user, token, setUserFromProfile } = useAuth();
  if (!token) return null;

  return (
    <ProfileSetupWizard
      token={token}
      username={user?.username}
      onProfileUpdate={setUserFromProfile}
      onDone={onDone}
    />
  );
}
