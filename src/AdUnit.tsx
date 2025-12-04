import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

// Updated to allow size controls
interface AdUnitProps {
  slotId: string;
  client: string;
  format?: string; // Optional: allows us to say 'horizontal'
  responsive?: string; // Optional
  style?: React.CSSProperties; // Optional: allows us to set max-height
}

export default function AdUnit({ 
  slotId, 
  client, 
  format = 'auto', 
  responsive = 'true',
  style = { display: 'block', width: '100%', height: '100%' }
}: AdUnitProps) {
  
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <div style={{ overflow: 'hidden', width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      ></ins>
    </div>
  );
}