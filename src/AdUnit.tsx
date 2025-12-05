import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdUnitProps {
  slotId: string;
  client: string;
  format?: string;
  responsive?: string;
  style?: React.CSSProperties;
}

export default function AdUnit({ 
  slotId, 
  client, 
  format = 'auto', 
  responsive = 'true',
  style = { display: 'block', width: '100%', height: '100%' }
}: AdUnitProps) {
  
  // 1. Create a reference to the actual <ins> element
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      // 2. SAFETY CHECK: Only push if the ad hasn't loaded yet
      // When AdSense loads, it changes the innerHTML of the <ins> tag.
      // If it's empty, we know it's safe to push.
      if (adRef.current && adRef.current.innerHTML === "") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error("AdSense Error:", e);
    }
  }, []);

  return (
    <div style={{ overflow: 'hidden', width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
      <ins
        ref={adRef} // 3. Attach the ref here
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