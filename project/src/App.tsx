import { ToastProvider } from '@/components/Toast';
import { DemoProvider, useDemoStore } from '@/lib/demoStore';
import Layout from '@/components/Layout';
import Overview from '@/pages/Overview';
import PortCallBoard from '@/pages/PortCallBoard';
import PortCallDetail from '@/pages/PortCallDetail';
import Vessels from '@/pages/Vessels';
import EmailInbox from '@/pages/EmailInbox';
import Operations from '@/pages/Operations';
import SuezTransit from '@/pages/SuezTransit';
import Disbursement from '@/pages/Disbursement';
import PdaVsFda from '@/pages/PdaVsFda';
import ClientPortal from '@/pages/ClientPortal';
import ActivityLog from '@/pages/ActivityLog';
import Settings from '@/pages/Settings';

function Shell() {
  const { route } = useDemoStore();
  // The client portal is a separate, read-only owner experience — no operator chrome.
  if (route.page === 'client-portal') return <ClientPortal />;

  const page = (() => {
    switch (route.page) {
      case 'port-calls': return <PortCallBoard />;
      case 'port-call-detail': return <PortCallDetail />;
      case 'vessels': return <Vessels />;
      case 'email-inbox': return <EmailInbox />;
      case 'operations': return <Operations />;
      case 'suez': return <SuezTransit />;
      case 'disbursement': return <Disbursement />;
      case 'pda-vs-fda': return <PdaVsFda />;
      case 'activity-log': return <ActivityLog />;
      case 'settings': return <Settings />;
      default: return <Overview />;
    }
  })();
  return <Layout>{page}</Layout>;
}

export default function App() {
  return (
    <ToastProvider>
      <DemoProvider>
        <Shell />
      </DemoProvider>
    </ToastProvider>
  );
}
