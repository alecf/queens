import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        setInterval(() => registration.update(), 60_000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="alert">
      <span>New version available</span>
      <button onClick={() => updateServiceWorker(true)}>Update</button>
    </div>
  );
}
