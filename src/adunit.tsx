import { useEffect } from 'react';
declare global { interface Window { adsbygoogle: any[]; } }
export default function AdUnit({ slotId, client }: { slotId: string, client: string }) {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { console.error(e); }
  }, []);
  return (
    <div style={{ overflow: 'hidden', width: '100%', height: '100%' }}>
      <ins className="adsbygoogle" style={{ display: 'block', width: '100%', height: '100%' }} data-ad-client={client} data-ad-slot={slotId} data-full-width-responsive="true"></ins>
    </div>
  );
}
