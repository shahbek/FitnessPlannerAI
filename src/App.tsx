import { FitnessLayout } from '@/components/layout/FitnessLayout';

// Add global error handler for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

export default function App() {
  return <FitnessLayout />;
}
