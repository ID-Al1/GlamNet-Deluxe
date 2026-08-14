/** Shared service category definitions with inline SVG icons. */

export interface ServiceCategory {
  name: string;
  icon: React.ReactNode;
}

const ICON_STROKE = "#6B1F2E";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    name: "Hair",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill={ICON_STROKE} opacity="0.15"/>
        <path d="M12 4C14.7 4 17 5.5 18 7.5C18 7.5 16.5 7 15 8C13.5 9 14 11 12 11C10 11 10.5 9 9 8C7.5 7 6 7.5 6 7.5C7 5.5 9.3 4 12 4Z" fill={ICON_STROKE}/>
        <path d="M12 20C9.5 20 7.5 18 6.5 16C6.5 16 8 16.5 9.5 15.5C11 14.5 10.5 12.5 12 12.5C13.5 12.5 13 14.5 14.5 15.5C16 16.5 17.5 16 17.5 16C16.5 18 14.5 20 12 20Z" fill={ICON_STROKE}/>
      </svg>
    ),
  },
  {
    name: "Makeup",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 16L16 7M6.5 16.5L16.5 6.5C17.3284 5.67157 18.6716 5.67157 19.5 6.5C20.3284 7.32843 20.3284 8.67157 19.5 9.5L9.5 19.5" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 9L15.5 10.5M5.5 17.5L4 19L5 20L6.5 18.5" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: "Nails",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9" y="8" width="6" height="12" rx="3" stroke={ICON_STROKE} strokeWidth="2"/>
        <path d="M10 4H14V8H10V4Z" stroke={ICON_STROKE} strokeWidth="2" strokeLinejoin="round"/>
        <path d="M11 2H13V4H11V2Z" fill={ICON_STROKE}/>
      </svg>
    ),
  },
  {
    name: "Barber",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 20L11 12M16 20L13 12M10 6L9 4M14 6L15 4" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="7" y="6" width="10" height="6" rx="2" stroke={ICON_STROKE} strokeWidth="2"/>
      </svg>
    ),
  },
  {
    name: "Skincare",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3C12 3 5 8 5 13C5 16.866 8.13401 20 12 20C15.866 20 19 16.866 19 13C19 8 12 3 12 3Z" stroke={ICON_STROKE} strokeWidth="2" strokeLinejoin="round"/>
        <path d="M12 20V22M9 17L7 19M15 17L17 19" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: "Lashes",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 12C2 12 6 8 12 8C18 8 22 12 22 12" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round"/>
        <path d="M5 10L4 7M8 9L7 6M12 8V5M16 9L17 6M19 10L20 7" stroke={ICON_STROKE} strokeWidth="2" strokeLinecap="round"/>
        <ellipse cx="12" cy="14" rx="4" ry="2.5" stroke={ICON_STROKE} strokeWidth="2"/>
      </svg>
    ),
  },
  {
    name: "Brows",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 10C3 10 6 7 10 7C12 7 13.5 8 15 8C17 8 19 7 21 7" stroke={ICON_STROKE} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M3 15C3 15 6 12 10 12C12 12 13.5 13 15 13C17 13 19 12 21 12" stroke={ICON_STROKE} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];
