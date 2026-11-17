import React from 'react';
const paths={
 grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 check:<path d="m5 12 4 4L19 6"/>,
 chevron:<path d="m9 5 7 7-7 7"/>,
 down:<path d="m6 9 6 6 6-6"/>,
 plus:<path d="M12 5v14M5 12h14"/>,
 close:<path d="m6 6 12 12M18 6 6 12"/>,
 search:<><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
 arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,
 external:<><path d="M14 3h7v7m0-7L10 14"/><path d="M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/></>,
 shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
 layers:<><path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
 bookmark:<path d="M6 3h12v18l-6-4-6 4Z"/>,
 book:<><path d="M3 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3Zm18 0h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6Z"/></>,
 wallet:<><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5a2 2 0 0 1 2-2h13m3 8h-6v5h6m-3-2.5h.1"/></>,
 refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 7A7 7 0 0 1 18 5l2 3M4 16l2 3a7 7 0 0 0 12.5-2"/></>,
 download:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
 code:<><path d="m7 6-6 6 6 6m10-12 6 6-6 6m-4-15-2 18"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
 warning:<><path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/></>,
 branch:<><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m0-3c8 0 12-2 12-7"/></>,
 copy:<><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
 menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
 file:<><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h6"/></>,
 spark:<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>
};
export default function Icon({name,size=18,...props}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.file}</svg>;}
