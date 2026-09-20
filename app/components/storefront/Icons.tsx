export function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function IconHeart({
  className = "h-5 w-5",
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

export function IconUser({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export function IconCart({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function IconWhatsApp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function IconHome({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

export function IconGrid({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 15h6v6H4v-6zm10 0h6v6h-6v-6z" />
    </svg>
  );
}

export function IconPlay({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function IconAltitude({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 9.2L12 4.8l4.5 4.4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.8L12 19.2l4.5-4.4" />
    </svg>
  );
}

export function IconShield({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden>
      <path
        strokeLinejoin="round"
        d="M12 3.2l7.2 3.1v5.4c0 4.35-2.85 8.2-7.2 9.7-4.35-1.5-7.2-5.35-7.2-9.7V6.3L12 3.2z"
      />
    </svg>
  );
}

export function IconHiker({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="13.6" cy="4.15" r="1.85" />
      <path d="M9.15 20.4a1.05 1.05 0 01.35-1.45l1.55-.95 1.05-3.15-1.7 1.05a1.1 1.1 0 01-1.5-.4L7.3 12.1a1.05 1.05 0 01.4-1.45l2.55-1.5 2.05-.35 1.15-1.95a1.05 1.05 0 011.8.2l1.05 1.9 2.55 1.05c.5.2.75.75.55 1.25-.2.5-.75.75-1.25.55l-2.05-.85-1.85 5.55 1.55 1.75.95 2.05a1.05 1.05 0 01-1.9.9l-1.15-2.45-1.85-2.1-1.15.7a1.05 1.05 0 01-1.45-.35z" />
      <path d="M16.7 11.05l2.35-1.35a.9.9 0 00.3-1.25.9.9 0 00-1.25-.3l-2.15 1.25.75 1.65z" />
    </svg>
  );
}

export function IconCompass({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.1" stroke="currentColor" strokeWidth={1.7} />
      <path
        fill="currentColor"
        d="M12 5.6l1.35 4.05 4.05 1.35-4.05 1.35L12 18.4l-1.35-4.05L6.6 13l4.05-1.35L12 5.6z"
      />
    </svg>
  );
}

export function IconWind({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" d="M3.5 10.2c2.4-2.2 4.6.4 6.8-1.7 2.3-2.2 4.4.4 7.4-1.4" />
      <path strokeLinecap="round" d="M5.2 15.6c2-1.8 3.8.3 5.8-1.5 2.1-1.9 3.8.3 6.8-1.2" />
    </svg>
  );
}

export function IconTruck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinejoin="round" d="M3.2 7.2h9.6v8.2H3.2z" />
      <path strokeLinejoin="round" d="M12.8 10.2h5.2l2.6 3.2v2h-7.8v-5.2z" />
      <circle cx="6.4" cy="17.6" r="1.45" />
      <circle cx="16.4" cy="17.6" r="1.45" />
    </svg>
  );
}

export function IconCreditCard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <rect x="3.2" y="6.2" width="17.6" height="11.6" rx="1.6" />
      <rect x="5.4" y="9.2" width="3.4" height="2.4" rx="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGuide({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinecap="round" d="M6.2 18.4c0-3.6 2.5-6.2 5.8-6.2s5.8 2.6 5.8 6.2" />
      <circle cx="12" cy="8.2" r="2.3" />
    </svg>
  );
}
