export function RescueMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="12" fill="#F15B66" fillOpacity=".1" stroke="#F15B66" strokeOpacity=".3" />
      <path d="M5.5 21h7.1l3.1-6.2 5.2 12.4 4.1-9.1 2 3h7.5" stroke="#F57880" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="21" r="1.3" fill="#F7A0A5" />
    </svg>
  );
}
