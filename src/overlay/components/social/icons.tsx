/** Reddit's "Snoo" face on a circular badge, used to identify the Reddit results group. */
export function RedditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="reddit-eye" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF8A4C" />
          <stop offset="100%" stopColor="#FF4500" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="#FF4500" />
      <path
        d="M12 7.4 C12.5 7.4 13.6 7.3 14.2 6.4"
        stroke="#ffffff"
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="15" cy="5.6" r="1.4" fill="#ffffff" />
      <ellipse cx="12" cy="14.2" rx="6.2" ry="5.3" fill="#fff" />
      <circle cx="6.5" cy="11.9" r="2" fill="#fff" />
      <circle cx="17.5" cy="11.9" r="2" fill="#fff" />
      <circle cx="9.5" cy="13.8" r="1.45" fill="url(#reddit-eye)" />
      <circle cx="14.5" cy="13.8" r="1.45" fill="url(#reddit-eye)" />
      <circle cx="9.05" cy="13.25" r="0.42" fill="#FFD7BD" />
      <circle cx="14.05" cy="13.25" r="0.42" fill="#FFD7BD" />
      <path d="M9.1 16.5 Q12 18.6 14.9 16.5 Q12 18.1 9.1 16.5 Z" fill="#1c1c1c" />
    </svg>
  );
}

/** Reddit's upvote arrow. */
export function RedditUpvoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4 L21 17 L3 17 Z" fill="#FF4500" />
    </svg>
  );
}

/** YouTube's play-button logo. */
export function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M23.498 6.186a2.997 2.997 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A2.997 2.997 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.997 2.997 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a2.997 2.997 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
        fill="#FF0000"
      />
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff" />
    </svg>
  );
}
