import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="alert">
      <span>New version available</span>
      <button onClick={() => updateServiceWorker(true)}>Update</button>
    </div>
  );
}
