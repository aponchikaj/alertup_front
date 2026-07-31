/* ============================================================================
   English — the source of truth for every translatable string.
   `ka.ts` is typed against this object, so a missing Georgian key is a
   compile error, not a silent English fallback in production.

   Keys are grouped by surface. Interpolation uses {name} placeholders.
   ========================================================================= */

export const en = {
  common: {
    home: "Home",
    scan: "Scan",
    contact: "Contact",
    dashboard: "Dashboard",
    buildings: "Buildings",
    new: "New",
    pricing: "Pricing",
    help: "Help",
    settings: "Settings",
    login: "Log in",
    register: "Sign up",
    logout: "Log out",
    getStarted: "Get started",
    getStartedFree: "Get started free",
    openDashboard: "Open dashboard",
    loading: "Loading…",
    error: "Something went wrong.",
    retry: "Retry",
    back: "Back",
    next: "Next",
    create: "Create",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    send: "Send message",
    sending: "Sending…",
    learnMore: "Learn more",
    free: "Free",
  },

  nav: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainLabel: "Main",
    switchLanguage: "Switch language",
  },

  footer: {
    tagline:
      "AlertUp turns a printed QR code into a guided way out. Scan it and the safest route to the nearest exit is already on screen.",
    product: "Product",
    support: "Support",
    legal: "Legal",
    scanACode: "Scan a code",
    addBuilding: "Add a building",
    myBuildings: "My buildings",
    contactUs: "Contact us",
    security: "Security",
    accessibility: "Accessibility",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    cookiePolicy: "Cookie Policy",
    builtIn: "AlertUp © {year}. Built in Tbilisi, Georgia.",
    disclaimer:
      "AlertUp supplements — it does not replace — the fire safety equipment, signage and procedures required at your location. In an emergency, always follow instructions from emergency services.",
  },

  home: {
    badge: "Scan once & be safe",
    heroTitleTop: "Every second",
    heroTitleBottom: "finds the exit.",
    heroLead1: "Scan once and find the ",
    heroLeadHighlight: "safest way out",
    heroLead2:
      ". AlertUp turns official escape maps into instant QR-code evacuation routes — for any building, on any phone.",
    howItWorks: "How it works",
    trustInstant: "Instant — no app install",
    trustMaps: "Per-building & per-floor maps",
    trustPhones: "Works on any phone",
    ownBuilding: "Own a building?",
    createRoute: "Create a QR route for it",
    servicesEyebrow: "What you get",
    servicesTitle: "Safety that fits on a sticker",
    servicesLead:
      "Everything a visitor needs in an emergency, behind one small printed code.",
    serviceInstructionsTitle: "Emergency Instructions",
    serviceInstructionsText:
      "Clear, step-by-step safety guidance tailored to the building and the type of emergency.",
    serviceMapsTitle: "Escape Route Maps",
    serviceMapsText:
      "Simple visual evacuation maps that show exits and safe paths inside the building.",
    serviceQrTitle: "QR Code Access",
    serviceQrText:
      "No app needed. Scan a QR code and instantly access emergency safety information.",
    aboutEyebrow: "Why AlertUp",
    aboutTitle: "Official maps, one scan away",
    aboutLead:
      "Building owners create a digital profile, upload their official escape and evacuation maps, and generate QR codes for every location. Printed and placed through the building, each code opens the safest route to an exit the moment it's scanned.",
    aboutPoint1:
      "Emergency instructions tailored to the building and emergency type",
    aboutPoint2: "Per-floor escape route maps showing exits and safe paths",
    aboutPoint3: "QR access with nothing to install",
    faqEyebrow: "FAQ",
    faqTitle: "Frequently asked questions",
    contactTitle: "Contact us",
    contactLead: "Questions about setting up your building? We answer every message.",
    contactSent: "Message sent — we'll get back to you soon.",
    emailLabel: "Email",
    reasonLabel: "Reason",
    reasonPlaceholder: "e.g. Setting up my building",
    messageLabel: "Message",
    messagePlaceholder: "Tell us what you need…",
    qrRejected: "Other QR codes can't be used.",
    qrOpenFailed: "Unable to open QR link.",
  },

  pricing: {
    title: "Simple pricing for safer buildings",
    lead: "Start free with your first building. Upgrade when you need more floors, more codes, and deeper analytics.",
    eyebrow: "Pricing",
    freeName: "Free",
    freeDesc: "For a single building and getting started.",
    freePrice: "0₾",
    proName: "Premium",
    proDesc: "For owners and managers with more to protect.",
    perMonth: "/month",
    featFreeBuildings: "1 building with unlimited floors",
    featFreeCodes: "Printable QR codes for every floor",
    featFreeInstructions: "Emergency instructions & escape maps",
    featProEverything: "Everything in Free",
    featProBuildings: "Unlimited buildings",
    featProAnalytics: "Scan & emergency analytics",
    featProLogs: "Full activity logs",
    featProSupport: "Priority support",
    startFree: "Start free",
    goPremium: "Go Premium",
    contactSales: "Questions? Contact us",
    faqNote: "Prices are illustrative — contact us for current plans.",
  },

  help: {
    title: "Help Center",
    lead: "Answers to common questions about scanning codes, adding buildings, and keeping evacuation maps up to date.",
    eyebrow: "Help",
    stillStuck: "Still stuck?",
    stillStuckLead: "Send us a message and a human will answer.",
    contactSupport: "Contact support",
    forVisitors: "For visitors",
    forOwners: "For building owners",
  },

  notFound: {
    title: "This route doesn't exist",
    lead: "The page you're looking for was moved or never existed. The safest way out is back to the homepage.",
    goHome: "Back to home",
  },

  dashboard: {
    title: "Your dashboard",
    lead: "Overview of your buildings, scans, and activity.",
    newBuilding: "New building",
    myBuildings: "My buildings",
    manageBuildings: "Manage buildings →",
    scansOfMyBuildings: "Scans of my buildings",
    scansOfMyBuildingsHint: "Total QR scans across all your buildings",
    codesIScanned: "Codes I scanned",
    noScansYet: "You haven't scanned a code yet",
    lastScan: "Last: {name}",
    plan: "Plan",
    renews: "Renews {date}",
    freePlanHint: "Free plan — first building included",
    scanActivity: "Scan activity",
    scanActivityLead: "Codes you scanned over the last 14 days.",
    activityEmpty: "Activity will appear here once scans start coming in.",
    recentScans: "Recent scans",
    recentScansLead: "Your latest scanned codes.",
    recentScansEmpty: "No scans yet — point your camera at an AlertUp code.",
    building: "Building",
    scanned: "Scanned",
  },
};

export type Messages = typeof en;
