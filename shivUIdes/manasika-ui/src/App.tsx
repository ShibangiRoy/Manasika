import { useEffect, useMemo, useState } from "react";
import manasikaLogo from "./assets/manasika-logo.webp";
import { getDatasetReflection } from "./cosmicDataset";
import { loadAstrologyLibrary, loadCosmicGraph, loadTarotLibrary, type AstrologyLibrary, type CosmicGraph, type CosmicRecord, type GraphNode, type TarotCard, type TarotLibrary } from "./cosmicLibrary";
import { getCompanionDatasetReply } from "./companionDataset";
import { getCreativePrompt, saveCreativeOutput } from "./creativeDataset";
import { deleteCreativeMedia, generateCreativeImage, generateCreativeText as requestCreativeText, getCreativeMediaStatus, getCreativeTrainingConsent, listCreativeMedia, saveCreativeInput, saveTrainingArtwork, setCreativeTrainingConsent, startCreativeSession, type CreativeMediaItem } from "./creativeMediaApi";

type Page =
  | "home"
  | "onboarding"
  | "dashboard"
  | "discover"
  | "reflection"
  | "mood"
  | "scenario"
  | "peace"
  | "student"
  | "creative"
  | "cosmic"
  | "zodiac-atlas"
  | "tarot"
  | "astro-graph"
  | "growth"
  | "companion"
  | "support"
  | "community";

type IconName =
  | "home"
  | "book"
  | "journal"
  | "mood"
  | "spark"
  | "leaf"
  | "student"
  | "palette"
  | "moon"
  | "growth"
  | "chat"
  | "heart"
  | "arrow"
  | "lock"
  | "menu"
  | "close"
  | "settings"
  | "check"
  | "play"
  | "search"
  | "plus"
  | "trash"
  | "clock"
  | "edit"
  | "users";

type UserProfile = {
  name: string;
  likes: string[];
  dislikes: string[];
  supportGoals: string[];
  insightsEnabled: boolean;
};

type MoodCheckIn = {
  id: string;
  date: string;
  mood: number;
  tags: string[];
  note: string;
};

type CommunityPost = {
  id: string;
  groupId: string;
  group: string;
  text: string;
  createdAt: string;
};

type ActivityItem = { id: string; date: string; action: string; area: string };
type ReflectionEntry = { id: number; date: string; localDay?: string; title: string; text: string; mood?: number | null };

const defaultProfile: UserProfile = {
  name: "",
  likes: [],
  dislikes: [],
  supportGoals: [],
  insightsEnabled: false,
};

function useSavedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The app remains usable if browser storage is disabled or full.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function todayKey() {
  return localDateKey(new Date());
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}

function formatLocalDate(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value.toString();
  return options.timeStyle || options.hour ? date.toLocaleString(undefined, options) : date.toLocaleDateString(undefined, options);
}

function recordActivity(setActivity: React.Dispatch<React.SetStateAction<ActivityItem[]>>, action: string, area: string) {
  setActivity((items) => [{ id: crypto.randomUUID(), date: new Date().toISOString(), action, area }, ...items].slice(0, 300));
}

const iconPaths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5a3.5 3.5 0 0 1 3.5 3z" />
    </>
  ),
  journal: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 3v18M11 8h5M11 12h5" />
    </>
  ),
  mood: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01M8 14.5c1.2 1.8 6.8 1.8 8 0" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C11 4 5 8.5 5 15c0 3 2 5 5 5 6.5 0 10-7 10-16Z" />
      <path d="M4 21c3-6 7-9 12-12" />
    </>
  ),
  student: (
    <>
      <path d="m3 9 9-5 9 5-9 5z" />
      <path d="M7 12v5c3 2 7 2 10 0v-5M21 9v6" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z" />
      <circle cx="7.5" cy="10" r=".7" />
      <circle cx="10" cy="6.8" r=".7" />
      <circle cx="15" cy="7" r=".7" />
    </>
  ),
  moon: <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />,
  growth: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-8M22 20V2" />
      <path d="m3 7 6-4 6 5 7-6" />
    </>
  ),
  chat: (
    <>
      <path d="M4 4h16v13H9l-5 4z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  heart: (
    <path d="M20.8 5.7a5.4 5.4 0 0 0-7.6 0L12 6.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z" />
  ),
  arrow: (
    <>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2.3-1.7.7-1.9-.9-2.1 2.1L2 8.1l-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2.3 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z"
        transform="translate(2)"
      />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  play: <path d="m8 5 11 7-11 7z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  edit: (
    <>
      <path d="m4 20 4-.8L19 8.3 15.7 5 4.8 15.9z" />
      <path d="m13.8 7 3.2 3.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.5V20" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "cosmic";
  icon?: IconName;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
      {icon && <Icon name={icon} size={17} />}
    </button>
  );
}

function Tag({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`tag ${active ? "tag-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="kicker">
      <span />
      <p>{children}</p>
    </div>
  );
}

const navItems: { id: Page; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "My Space", icon: "home" },
  { id: "discover", label: "Discover", icon: "book" },
  { id: "reflection", label: "Reflection", icon: "journal" },
  { id: "mood", label: "Mood Journey", icon: "mood" },
  { id: "scenario", label: "Scenarios", icon: "spark" },
  { id: "peace", label: "Peace Corner", icon: "leaf" },
  { id: "student", label: "Student Life", icon: "student" },
  { id: "creative", label: "Creative Space", icon: "palette" },
  { id: "cosmic", label: "Cosmic Corner", icon: "moon" },
  { id: "growth", label: "My Growth", icon: "growth" },
  { id: "companion", label: "AI Companion", icon: "chat" },
  { id: "support", label: "Find Support", icon: "heart" },
  { id: "community", label: "Community", icon: "users" },
];

const moods = [
  { emoji: "😄", label: "Amazing", tone: "amazing" },
  { emoji: "🙂", label: "Good", tone: "good" },
  { emoji: "😐", label: "Okay", tone: "okay" },
  { emoji: "😔", label: "Low", tone: "low" },
  { emoji: "😢", label: "Difficult", tone: "difficult" },
];

const emotionTags = [
  "Happy",
  "Anxious",
  "Excited",
  "Stressed",
  "Lonely",
  "Motivated",
  "Overwhelmed",
  "Peaceful",
  "Confused",
  "Grateful",
  "Tired",
  "Hopeful",
];

const topics = [
  {
    title: "Attachment Theory",
    text: "Explore how early bonds may shape the ways we seek closeness and safety.",
    time: "8 min",
    icon: "heart" as IconName,
    category: "Relationships",
  },
  {
    title: "People-Pleasing",
    text: "Understand why saying yes can feel safer than expressing what you need.",
    time: "6 min",
    icon: "leaf" as IconName,
    category: "Self-awareness",
  },
  {
    title: "Emotional Boundaries",
    text: "Learn gentle ways to protect your energy while staying connected.",
    time: "7 min",
    icon: "spark" as IconName,
    category: "Relationships",
  },
  {
    title: "Emotional Regulation",
    text: "Practical ways to make space for a feeling before choosing your next step.",
    time: "9 min",
    icon: "mood" as IconName,
    category: "Wellbeing",
  },
  {
    title: "Learned Helplessness",
    text: "Why repeated setbacks can make change feel impossible—and how agency returns.",
    time: "10 min",
    icon: "growth" as IconName,
    category: "Self-awareness",
  },
  {
    title: "Hypervigilance",
    text: "A gentle guide to understanding why your mind may stay alert for danger.",
    time: "7 min",
    icon: "moon" as IconName,
    category: "Wellbeing",
  },
  {
    title: "Childhood Conditioning",
    text: "Notice inherited rules and decide which ones still belong in your life.",
    time: "11 min",
    icon: "book" as IconName,
    category: "Self-awareness",
  },
  {
    title: "Self-Esteem",
    text: "Build a kinder inner relationship that is not dependent on achievement.",
    time: "8 min",
    icon: "heart" as IconName,
    category: "Growth",
  },
];

const communityGroups = [
  { id: "quiet-study", name: "Quiet Study Circle", text: "Gentle study check-ins and kinder plans.", tags: ["Learning", "Quiet time", "Academic pressure"], icon: "student" as IconName },
  { id: "creative-corner", name: "Creative Corner", text: "Share prompts, sketches, music, and small ideas.", tags: ["Art", "Music", "Writing"], icon: "palette" as IconName },
  { id: "soft-starts", name: "Soft Starts", text: "A calm place for routines, rest, and starting again.", tags: ["Rest & sleep", "Nature", "Movement"], icon: "leaf" as IconName },
  { id: "friendship", name: "Friendship & Boundaries", text: "Talk through connection, confidence, and limits.", tags: ["Friends", "Relationships", "Confidence & overthinking"], icon: "heart" as IconName },
];

const zodiacSigns = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] as const;
type ZodiacSign = (typeof zodiacSigns)[number];
const zodiacInfo: Record<ZodiacSign, { symbol: string; element: string; traits: [string, string, string]; archetype: string; messages: [string, string, string] }> = {
  Aries: { symbol: "♈", element: "Fire", traits: ["Courage", "Initiative", "Honesty"], archetype: "Courage, initiative & fresh starts", messages: ["You can begin again without having every answer.", "Let your energy serve what matters to you today.", "A small brave step is still a meaningful step."] },
  Taurus: { symbol: "♉", element: "Earth", traits: ["Steadiness", "Patience", "Senses"], archetype: "Steadiness, patience & the senses", messages: ["There is strength in choosing a pace you can sustain.", "Let one comforting ordinary thing be enough for now.", "You are allowed to build slowly and steadily."] },
  Gemini: { symbol: "♊", element: "Air", traits: ["Curiosity", "Ideas", "Connection"], archetype: "Curiosity, ideas & connection", messages: ["Curiosity can open a door without requiring a decision.", "You may hold more than one thought while you work things out.", "A thoughtful conversation can start with one honest question."] },
  Cancer: { symbol: "♋", element: "Water", traits: ["Care", "Memory", "Belonging"], archetype: "Care, memory & belonging", messages: ["Care for yourself with the same gentleness you offer others.", "It is okay to make room for a feeling before acting on it.", "Belonging can include being fully yourself."] },
  Leo: { symbol: "♌", element: "Fire", traits: ["Warmth", "Expression", "Generosity"], archetype: "Warmth, expression & generosity", messages: ["Your presence matters even when you are not performing.", "Let yourself enjoy a small thing without earning it.", "Sharing your creativity can begin privately, just for you."] },
  Virgo: { symbol: "♍", element: "Earth", traits: ["Care", "Craft", "Attention"], archetype: "Care, craft & thoughtful attention", messages: ["Progress does not require perfect conditions.", "Choose one manageable thing and let the rest wait.", "Your worth is larger than what you complete today."] },
  Libra: { symbol: "♎", element: "Air", traits: ["Balance", "Beauty", "Perspective"], archetype: "Balance, creativity & thoughtful connection", messages: ["Your voice and your pace both deserve respect.", "You can care about harmony while still naming what you need.", "A balanced choice can include your own wellbeing."] },
  Scorpio: { symbol: "♏", element: "Water", traits: ["Depth", "Privacy", "Resolve"], archetype: "Depth, privacy & quiet resolve", messages: ["You can share only what feels safe to share.", "A quiet boundary is still a boundary.", "Change can happen privately, one choice at a time."] },
  Sagittarius: { symbol: "♐", element: "Fire", traits: ["Wonder", "Learning", "Possibility"], archetype: "Wonder, learning & possibility", messages: ["You can explore a possibility without committing to it yet.", "Learning something new is progress even when it is small.", "Let hope be gentle rather than demanding."] },
  Capricorn: { symbol: "♑", element: "Earth", traits: ["Commitment", "Practice", "Structure"], archetype: "Commitment, practice & steady structure", messages: ["Rest can be part of a sustainable plan.", "You do not have to carry every responsibility alone.", "One kind step counts, even if it is not the whole plan."] },
  Aquarius: { symbol: "♒", element: "Air", traits: ["Originality", "Ideas", "Community"], archetype: "Originality, ideas & community", messages: ["Your different perspective is welcome here.", "Connection can begin with shared curiosity.", "You can make space for belonging and individuality."] },
  Pisces: { symbol: "♓", element: "Water", traits: ["Imagination", "Sensitivity", "Compassion"], archetype: "Imagination, sensitivity & compassion", messages: ["Your imagination can be a gentle place to rest.", "Sensitivity is information; you choose what to do with it.", "Offer yourself compassion before asking for certainty."] },
};

function zodiacFromBirthDate(value: string): ZodiacSign | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d) || date > new Date()) return null;
  const monthDay = Number(m) * 100 + Number(d);
  if (monthDay >= 321 && monthDay <= 419) return "Aries";
  if (monthDay >= 420 && monthDay <= 520) return "Taurus";
  if (monthDay >= 521 && monthDay <= 620) return "Gemini";
  if (monthDay >= 621 && monthDay <= 722) return "Cancer";
  if (monthDay >= 723 && monthDay <= 822) return "Leo";
  if (monthDay >= 823 && monthDay <= 922) return "Virgo";
  if (monthDay >= 923 && monthDay <= 1022) return "Libra";
  if (monthDay >= 1023 && monthDay <= 1121) return "Scorpio";
  if (monthDay >= 1122 && monthDay <= 1221) return "Sagittarius";
  if (monthDay >= 1222 || monthDay <= 119) return "Capricorn";
  if (monthDay <= 218) return "Aquarius";
  return "Pisces";
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="MANASIKA home">
      <span className="logo-mark" aria-hidden="true">
        <img src={manasikaLogo} alt="" />
      </span>
      <span>
        <b>MANASIKA</b>
        <small>mind · kindness · hope</small>
      </span>
    </button>
  );
}

function AppShell({
  page,
  setPage,
  children,
  openSettings,
  profile,
}: {
  page: Page;
  setPage: (p: Page) => void;
  children: React.ReactNode;
  openSettings: () => void;
  profile: UserProfile;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <Logo onClick={() => setPage("home")} />
        <button className="icon-btn" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          <Icon name="menu" />
        </button>
      </header>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Logo onClick={() => setPage("home")} />
          <button
            className="icon-btn mobile-only"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id || (item.id === "cosmic" && ["zodiac-atlas", "tarot", "astro-graph"].includes(page)) ? "active" : ""}
              onClick={() => {
                setPage(item.id);
                setMobileOpen(false);
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="profile-card" onClick={openSettings}>
          <span className="avatar">{profile.name.trim().slice(0, 1).toUpperCase() || "M"}</span>
          <span>
            <b>{profile.name || "Your space"}</b>
            <small>View preferences</small>
          </span>
          <Icon name="settings" size={17} />
        </button>
      </aside>
      {mobileOpen && (
        <button className="scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      )}
      <main className="app-main">{children}</main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            className={page === item.id || (item.id === "cosmic" && ["zodiac-atlas", "tarot", "astro-graph"].includes(page)) ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={() => setMobileOpen(true)}>
          <Icon name="menu" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

function Landing({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo onClick={() => setPage("home")} />
        <nav>
          <button onClick={() => setPage("discover")}>Discover</button>
          <button onClick={() => setPage("peace")}>Peace Corner</button>
          <button onClick={() => setPage("student")}>Student Life</button>
          <button onClick={() => setPage("cosmic")}>Cosmic Corner</button>
        </nav>
        <div className="landing-actions">
          <Button variant="ghost" onClick={() => setPage("dashboard")}>
            Sign in
          </Button>
          <Button onClick={() => setPage("onboarding")}>Begin your journey</Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Kicker>Your quiet corner on a noisy day</Kicker>
            <h1>
              Your past shaped you.
              <br />
              <em>It doesn’t have to define you.</em>
            </h1>
            <p>
              A little space to understand yourself, navigate college life, and become the person
              you want to be.
            </p>
            <div className="hero-actions">
              <Button onClick={() => setPage("onboarding")} icon="arrow">
                Begin your journey
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore Manasika
              </Button>
            </div>
            <div className="trust-row">
              <span>
                <Icon name="lock" />
                Private by design
              </span>
              <span>
                <Icon name="heart" />
                Made for student life
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="photo-frame">
              <img
                src="https://images.unsplash.com/photo-1517971129774-8a2b38fa128e?auto=format&fit=crop&w=1000&q=85"
                alt="A student taking a calm moment to write in a journal by a window"
              />
            </div>
            <div className="floating-card float-top">
              <span className="mini-icon">
                <Icon name="spark" />
              </span>
              <p>Today’s reminder</p>
              <b>You don’t have to solve everything today.</b>
            </div>
            <div className="floating-card float-bottom">
              <span className="tiny-orb" />
              <p>One gentle check-in</p>
              <b>How are you, really?</b>
            </div>
            <div className="botanical botanical-a">⌇</div>
            <div className="botanical botanical-b">⌇</div>
          </div>
        </section>
        <section className="intro-strip" id="explore">
          <Kicker>What is Manasika?</Kicker>
          <h2>A thoughtful companion for the days you’re growing through.</h2>
          <p>
            Not a clinic. Not a productivity race. A private, evidence-informed space where your
            inner life and student life can breathe together.
          </p>
        </section>
        <section className="pillars">
          {[
            [
              "01",
              "Understand",
              "Make sense of emotions and patterns through accessible psychology.",
            ],
            [
              "02",
              "Reflect",
              "Pause, write, and listen to yourself without pressure or judgement.",
            ],
            [
              "03",
              "Grow",
              "Turn small insights into boundaries, habits, and a future that feels yours.",
            ],
          ].map((p, i) => (
            <article key={p[1]} className={`pillar pillar-${i + 1}`}>
              <span>{p[0]}</span>
              <Icon name={i === 0 ? "book" : i === 1 ? "journal" : "growth"} size={29} />
              <h3>{p[1]}</h3>
              <p>{p[2]}</p>
            </article>
          ))}
        </section>
        <section className="feature-editorial">
          <div>
            <Kicker>Made for your real life</Kicker>
            <h2>
              Care for your mind.
              <br />
              Make college feel lighter.
            </h2>
            <p>
              From exam pressure and uncertain futures to relationships, routines, and rest—find
              support that meets you where you are.
            </p>
            <Button variant="secondary" onClick={() => setPage("dashboard")} icon="arrow">
              Visit your space
            </Button>
          </div>
          <div className="feature-grid">
            {[
              ["mood", "Mood Journey", "Notice patterns without scores or labels."],
              ["leaf", "Peace Corner", "Breathing, grounding and gentle rest."],
              ["student", "Student Life", "Practical help for study and future stress."],
              ["moon", "Cosmic Corner", "Playful, positive self-discovery."],
            ].map((f) => (
              <button
                key={f[1]}
                onClick={() =>
                  setPage(
                    f[0] === "mood"
                      ? "mood"
                      : f[0] === "leaf"
                        ? "peace"
                        : f[0] === "student"
                          ? "student"
                          : "cosmic",
                  )
                }
              >
                <Icon name={f[0] as IconName} />
                <span>
                  <b>{f[1]}</b>
                  <small>{f[2]}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo onClick={() => setPage("home")} />
        <p>
          “A little space for your mind, a little kindness for yourself, and a little hope for
          tomorrow.”
        </p>
        <span>Educational wellness support, not medical care.</span>
      </footer>
    </div>
  );
}

function Onboarding({ finish }: { finish: (profile: UserProfile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const steps = [
    <div className="onboard-step" key="welcome">
      <span className="onboard-symbol">
        <Icon name="leaf" size={34} />
      </span>
      <Kicker>Welcome to MANASIKA</Kicker>
      <h1>This is your space.</h1>
      <p>
        You can take things at your own pace. Everything here is optional, private, and yours to
        shape.
      </p>
      <label className="field">
        <span>
          What should we call you? <small>Optional</small>
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your preferred name"
        />
      </label>
    </div>,
    <div className="onboard-step" key="support">
      <Kicker>A little about you</Kicker>
      <h1>Where would support feel helpful?</h1>
      <p>Choose as many as you like. You can change these anytime.</p>
      <div className="choice-grid">
        {[
          "Academic pressure",
          "Confidence & overthinking",
          "Relationships",
          "Family expectations",
          "Rest & sleep",
          "Future uncertainty",
        ].map((x) => (
          <Tag
            key={x}
            active={selected.includes(x)}
            onClick={() =>
              setSelected((s) => (s.includes(x) ? s.filter((v) => v !== x) : [...s, x]))
            }
          >
            {x}
          </Tag>
        ))}
      </div>
    </div>,
    <div className="onboard-step" key="preferences">
      <Kicker>Your preferences · all optional</Kicker>
      <h1>What feels like you?</h1>
      <p>Choose things you enjoy and things you would rather not see in suggestions.</p>
      <div className="preference-columns">
        <div><b>I enjoy</b><div className="tag-wrap">{["Writing", "Music", "Art", "Nature", "Movement", "Quiet time", "Friends", "Learning"].map((x) => <Tag key={x} active={likes.includes(x)} onClick={() => setLikes((items) => items.includes(x) ? items.filter((v) => v !== x) : [...items, x])}>{x}</Tag>)}</div></div>
        <div><b>I prefer to avoid</b><div className="tag-wrap">{["Breathing exercises", "Astrology", "Group sharing", "Notifications", "Long writing", "Motivational quotes"].map((x) => <Tag key={x} active={dislikes.includes(x)} onClick={() => setDislikes((items) => items.includes(x) ? items.filter((v) => v !== x) : [...items, x])}>{x}</Tag>)}</div></div>
      </div>
      <label className="setting-row onboarding-insights">
        <span><b>Show me a private activity summary</b><small>Uses only the sections you visit and check-ins you save on this device. No typing or message content is analyzed.</small></span>
        <span className="switch"><input type="checkbox" checked={insightsEnabled} onChange={(event) => setInsightsEnabled(event.target.checked)} /><i /></span>
      </label>
    </div>,
    <div className="onboard-step complete" key="complete">
      <span className="onboard-symbol success">
        <Icon name="check" size={34} />
      </span>
      <Kicker>You’re all set{name ? `, ${name}` : ""}</Kicker>
      <h1>Your journey begins with understanding yourself.</h1>
      <p>
        There is no right place to begin. Check in with your mood, explore a topic, or simply take a
        breath.
      </p>
    </div>,
  ];
  return (
    <div className="onboarding">
      <div className="onboard-aside">
        <Logo onClick={() => {}} />
        <div>
          <span className="quote-mark">“</span>
          <blockquote>
            Your feelings are information—not instructions, not flaws, and never your whole story.
          </blockquote>
        </div>
        <small>
          <Icon name="lock" /> Your answers stay private
        </small>
      </div>
      <main className="onboard-main">
        <div className="onboard-progress">
          <span>
            Step {step + 1} of {steps.length}
          </span>
          <div>
            {steps.map((_, i) => (
              <i key={i} className={i <= step ? "done" : ""} />
            ))}
          </div>
        </div>
        {steps[step]}
        <div className="onboard-actions">
          {step < steps.length - 1 ? (
            <button className="text-btn" onClick={() => setStep(step + 1)}>
              Skip for now
            </button>
          ) : (
            <span />
          )}
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button
              onClick={() =>
                step === steps.length - 1
                  ? finish({ name: name.trim(), likes, dislikes, supportGoals: selected, insightsEnabled })
                  : setStep(step + 1)
              }
              icon={step === steps.length - 1 ? "home" : "arrow"}
            >
              {step === steps.length - 1 ? "Enter my space" : "Continue"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <Kicker>{eyebrow}</Kicker>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </header>
  );
}

function MoodPicker({
  selectedMood,
  onSelect,
  compact = false,
}: {
  selectedMood: number | null;
  onSelect: (i: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`mood-picker ${compact ? "compact" : ""}`}>
      {moods.map((m, i) => (
        <button
          key={m.label}
          className={`${selectedMood === i ? "selected" : ""} mood-${m.tone}`}
          onClick={() => onSelect(i)}
          aria-pressed={selectedMood === i}
        >
          <span>{m.emoji}</span>
          <b>{m.label}</b>
        </button>
      ))}
    </div>
  );
}

function Dashboard({
  setPage,
  mood,
  setMood,
  profile,
  checkIns,
}: {
  setPage: (p: Page) => void;
  mood: number | null;
  setMood: (n: number) => void;
  profile: UserProfile;
  checkIns: MoodCheckIn[];
}) {
  const now = useCurrentTime();
  const [reflections] = useSavedState<ReflectionEntry[]>("manasika.reflections.v1", []);
  const [cosmicSign] = useSavedState<ZodiacSign>("manasika.cosmic.sign.v1", "Libra");
  const [saved, setSaved] = useState(false);
  const lowMood = mood !== null && mood >= 3;
  const kindChoice = profile.likes.includes("Art") ? "creative" : profile.likes.includes("Writing") ? "reflective" : "gentle";
  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow={`${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`}
        title={`Welcome${profile.name ? ` back, ${profile.name}` : " to your space"}.`}
        text={lowMood ? "Let’s make today a little gentler, one small step at a time." : mood !== null ? "You checked in today. Keep what feels good close, and take the next moment as it comes." : "How are you feeling today? There is no right answer."}
        action={
          <button className="privacy-pill">
            <Icon name="lock" />
            Your space is private
          </button>
        }
      />
      <section className="mood-hero-card">
        <div className="mood-card-copy">
          <span className="card-icon">
            <Icon name="mood" />
          </span>
          <h2>Take a moment for yourself.</h2>
              <p>{lowMood ? "A difficult feeling deserves care, not pressure. You do not have to solve the whole day." : "Every feeling deserves a little space."}</p>
          {saved && (
            <div className="success-note">
              <Icon name="check" /> Thank you for checking in with yourself.
            </div>
          )}
        </div>
        <div>
          <MoodPicker
            selectedMood={mood}
            onSelect={(n) => {
              setMood(n);
              setSaved(true);
            }}
            compact
          />
          <button className="small-link" onClick={() => setPage("mood")}>
            {saved ? "Add emotions or edit check-in" : "View your mood journey"}{" "}
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="dash-main">
          <div className="section-heading">
            <div>
              <Kicker>For your day</Kicker>
              <h2>A few gentle next steps</h2>
            </div>
            <button onClick={() => setPage("discover")}>See all</button>
          </div>
          <div className="recommend-grid">
            <button className="recommend-card peach" onClick={() => setPage("peace")}>
              <span className="card-icon">
                <Icon name="leaf" />
              </span>
              <span className="duration">
                <Icon name="clock" /> 3 min
              </span>
              <h3>{lowMood ? "Take one small pause" : kindChoice === "creative" ? "Make a tiny thing" : "Let your shoulders drop"}</h3>
              <p>{lowMood ? "A short grounding pause can help make this moment feel more manageable." : kindChoice === "creative" ? "A low-pressure creative prompt, just for you." : "A short grounding pause for the space between classes."}</p>
              <span className="card-link">
                Begin exercise <Icon name="arrow" />
              </span>
            </button>
            <button className="recommend-card sage" onClick={() => setPage("reflection")}>
              <span className="card-icon">
                <Icon name="journal" />
              </span>
              <span className="duration">
                <Icon name="clock" /> 5 min
              </span>
              <h3>{lowMood ? "Name what you need" : "Today’s reflection"}</h3>
              <p>{lowMood ? "What is one kind thing you can offer yourself in the next ten minutes?" : "What is one thing you need less of today?"}</p>
              <span className="card-link">
                Start writing <Icon name="arrow" />
              </span>
            </button>
            <button className="recommend-card lavender" onClick={() => setPage("discover")}>
              <span className="card-icon">
                <Icon name="book" />
              </span>
              <span className="duration">
                <Icon name="clock" /> 7 min
              </span>
              <h3>Continue learning</h3>
              <p>Emotional Boundaries · 60% complete</p>
              <span className="progress-line">
                <i />
              </span>
              <span className="card-link">
                Continue <Icon name="arrow" />
              </span>
            </button>
          </div>
          <div className="section-heading">
            <div>
              <Kicker>Student life</Kicker>
              <h2>One thing at a time</h2>
            </div>
          </div>
          <div className="student-banner">
            <div>
              <span>THIS WEEK</span>
              <h3>Your placement prep, without the panic.</h3>
              <p>Break one big worry into three small, manageable steps.</p>
              <Button variant="secondary" onClick={() => setPage("student")} icon="arrow">
                Open student companion
              </Button>
            </div>
            <div className="stack-illustration">
              <span />
              <span />
              <span />
              <Icon name="student" size={44} />
            </div>
          </div>
        </section>
        <aside className="dash-side">
          <button className="cosmic-widget" onClick={() => setPage("cosmic")}>
            <span className="stars">✦ · ˚ ✧</span>
            <small>TODAY’S COSMIC MESSAGE</small>
            <div className="zodiac">{zodiacInfo[cosmicSign].symbol}</div>
            <h3>{zodiacInfo[cosmicSign].messages[Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000) % 3]}</h3>
            <p>For {cosmicSign} · reflective and just for fun.</p>
            <span>
              Explore Cosmic Corner <Icon name="arrow" />
            </span>
          </button>
          <button className="ai-widget" onClick={() => setPage("companion")}>
            <span className="ai-orb">
              <Icon name="spark" />
            </span>
            <div>
              <small>MANASIKA COMPANION</small>
              <h3>Want to talk it through?</h3>
              <p>A thoughtful space to organize what’s on your mind.</p>
              <span>
                Start a conversation <Icon name="arrow" />
              </span>
            </div>
          </button>
          <button className="growth-widget" onClick={() => setPage("growth")}>
            <div>
              <small>YOUR GROWTH</small>
              <h3>{checkIns.filter((item) => new Date(`${item.date}T00:00:00`).getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000).length + reflections.filter((item) => new Date(item.date).getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000).length} small moments this week</h3>
            </div>
            <div className="week-dots">
              {Array.from({ length: 7 }, (_, i) => {
                const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
                const dayKey = localDateKey(day);
                const active = checkIns.some((item) => item.date === dayKey) || reflections.some((item) => (item.localDay || (Number.isNaN(new Date(item.date).getTime()) ? "" : localDateKey(new Date(item.date)))) === dayKey);
                return <span key={dayKey} className={active ? "filled" : ""} title={day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}>{day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</span>;
              })}
            </div>
            <p>Your check-ins and reflections shape this private view. No streaks or scores.</p>
          </button>
        </aside>
      </div>
    </div>
  );
}

function Discover({ setPage }: { setPage: (p: Page) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All topics");
  const [article, setArticle] = useState<(typeof topics)[0] | null>(null);
  const shown = topics.filter(
    (t) =>
      (category === "All topics" || t.category === category) &&
      `${t.title} ${t.text} ${t.category}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  if (article)
    return (
      <div className="page article-page">
        <button className="back-link" onClick={() => setArticle(null)}>
          ← Back to library
        </button>
        <article className="article">
          <Kicker>
            {article.category} · {article.time} read
          </Kicker>
          <h1>{article.title}</h1>
          <p className="lead">{article.text}</p>
          <div className="article-note">
            <Icon name="heart" />
            <p>
              This article offers educational ideas, not a diagnosis. Take what feels useful and
              leave the rest.
            </p>
          </div>
          <h2>What might this look like?</h2>
          <p>
            Sometimes, a familiar emotional pattern can become an automatic response. You might
            notice yourself agreeing before checking what you want, feeling responsible for someone
            else’s disappointment, or treating rest as something you must earn.
          </p>
          <details open>
            <summary>The psychology, in everyday language</summary>
            <p>
              Psychologists describe boundaries as the limits that help us understand where our
              responsibilities end and another person’s begin. They can be flexible and caring;
              having a boundary does not mean you care less.
            </p>
          </details>
          <details>
            <summary>A real-life example</summary>
            <p>
              A classmate asks for your notes the night before an exam. You want to help, but you
              also need to revise. A boundary might sound like: “I can share the first two chapters
              tonight, but I need the rest of the evening for my own preparation.”
            </p>
          </details>
          <details>
            <summary>Practical takeaways</summary>
            <p>
              Pause before answering. Name what you can offer. Keep explanations simple. Remember
              that another person’s reaction is information, not proof that your choice was wrong.
            </p>
          </details>
          <div className="reflection-callout">
            <Icon name="journal" />
            <div>
              <small>REFLECTION PROMPT</small>
              <h3>Where do you wish it felt safer to say “not right now”?</h3>
              <Button onClick={() => setPage("reflection")} icon="arrow">
                Reflect in your journal
              </Button>
            </div>
          </div>
        </article>
      </div>
    );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Psychology, made human"
        title="Discover yourself with curiosity."
        text="Accessible ideas to help you understand patterns—not put yourself in a box."
      />
      <div className="library-tools">
        <label className="search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a topic..."
          />
        </label>
        <div className="filter-row">
          {["All topics", "Self-awareness", "Relationships", "Wellbeing", "Growth"].map((c) => (
            <Tag key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Tag>
          ))}
        </div>
      </div>
      <div className="topic-grid">
        {shown.map((topic, i) => (
          <article key={topic.title} className={`topic-card topic-tone-${i % 4}`}>
            <div className="topic-art">
              <Icon name={topic.icon} size={29} />
            </div>
            <span>
              {topic.category} · {topic.time}
            </span>
            <h2>{topic.title}</h2>
            <p>{topic.text}</p>
            <button onClick={() => setArticle(topic)}>
              Read article <Icon name="arrow" />
            </button>
          </article>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="empty-state">
          <Icon name="search" size={32} />
          <h3>No topics found</h3>
          <p>Try a different word or browse all topics.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setCategory("All topics");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

function Reflection({ onActivity, checkIns, setPage }: { onActivity: () => void; checkIns: MoodCheckIn[]; setPage: (page: Page) => void }) {
  const now = useCurrentTime();
  const [entry, setEntry] = useState("");
  const [title, setTitle] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const reflectionPrompts = [
    "What are you carrying today that you don’t need to carry alone?",
    "What made you feel a little more like yourself today?",
    "What is one kind thing you can offer yourself next?",
    "What would you like to remember from this moment?",
  ];
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [savedEntries, setSavedEntries] = useSavedState<ReflectionEntry[]>("manasika.reflections.v1", []);
  const [saved, setSaved] = useState(false);
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const reflectionDays = new Set(savedEntries.map((item) => item.localDay || (Number.isNaN(new Date(item.date).getTime()) ? "" : localDateKey(new Date(item.date)))).filter(Boolean));
  const checkedMoodDays = new Set(checkIns.map((item) => item.date));
  const save = () => {
    if (!entry.trim()) return;
    setSavedEntries([
      { id: Date.now(), date: new Date().toISOString(), localDay: todayKey(), mood: selectedMood, title: title.trim() || `Reflection · ${formatLocalDate(new Date())}`, text: entry },
      ...savedEntries,
    ]);
    onActivity();
    setSaved(true);
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Private reflection room"
        title="A space to understand yourself."
        text="No audience. No streak to protect. Just a quieter place to hear your own thoughts."
        action={
          <span className="privacy-pill">
            <Icon name="lock" />
            Only you can see this
          </span>
        }
      />
      <div className="reflection-layout">
        <section className="journal-card">
          <div className="prompt-strip">
            <span>
              <Icon name="spark" />
            </span>
            <div>
              <small>TODAY’S PROMPT</small>
              <h2>{reflectionPrompts[promptIndex]}</h2>
            </div>
            <button onClick={() => setPromptIndex((index) => (index + 1) % reflectionPrompts.length)}>New prompt</button>
          </div>
          <label className="journal-editor">
            <span>{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this moment a title..." />
            <textarea
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value);
                setSaved(false);
              }}
              placeholder="Start wherever you are. There is no right way to write..."
            />
          </label>
          <div className="journal-footer">
            <div>
              <span>How did this day feel?</span>
              <MoodPicker compact selectedMood={selectedMood} onSelect={setSelectedMood} />
            </div>
            <div>
              {saved && (
                <span className="saved">
                  <Icon name="check" /> Saved privately
                </span>
              )}
              <Button onClick={save} disabled={!entry.trim()}>
                Save entry
              </Button>
            </div>
          </div>
        </section>
        <aside className="entry-side">
          <div className="mini-calendar">
            <div>
              <h3>{monthLabel}</h3>
              <button onClick={() => setPage("mood")}>View mood</button>
            </div>
            <div className="calendar-mini-grid">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <b key={i}>{d}</b>
              ))}
              {Array.from({ length: firstWeekday }, (_, i) => <span key={`blank-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasMood = checkedMoodDays.has(dateKey);
                const hasReflection = reflectionDays.has(dateKey);
                return (
                <span
                  key={day}
                  className={hasMood ? `dot-tone-${checkIns.find((item) => item.date === dateKey)!.mood}` : hasReflection ? "dot-tone-1" : ""}
                >
                  {day}
                </span>
                );
              })}
            </div>
          </div>
          <div className="previous-entries">
            <div>
              <h3>Previous entries</h3>
              <span>{savedEntries.length} entries</span>
            </div>
            {savedEntries.map((e) => (
              <article key={e.id}>
                <small>{formatLocalDate(e.date, { dateStyle: "medium", timeStyle: "short" })}</small>
                <h4>{e.title}</h4>
                <p>{e.text}</p>
                <div>
                  <button onClick={() => { setEntry(e.text); setTitle(e.title); setSaved(false); }}>
                    <Icon name="edit" /> Edit
                  </button>
                  <button onClick={() => setSavedEntries((s) => s.filter((v) => v.id !== e.id))}>
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MoodJourney({
  mood,
  setMood,
  checkIns,
  onSave,
}: {
  mood: number | null;
  setMood: (n: number | null) => void;
  checkIns: MoodCheckIn[];
  onSave: (entry: Omit<MoodCheckIn, "id" | "date">) => void;
}) {
  const now = useCurrentTime();
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  monthDate.setMonth(monthDate.getMonth() + monthOffset);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const blankDays = (monthDate.getDay() + 6) % 7;
  const checkInForDay = (day: number) => checkIns.find((item) => item.date === `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  return (
    <div className="page">
      <PageHeader
        eyebrow="Your emotional weather"
        title="Mood Journey"
        text="Notice how your days feel—without judging, scoring, or diagnosing them."
        action={
          <span className="privacy-pill">
            <Icon name="lock" />
            Private to you
          </span>
        }
      />
      <section className="checkin-card">
        <div className="checkin-head">
          <span className="card-icon">
            <Icon name="mood" />
          </span>
          <div>
            <small>DAILY CHECK-IN</small>
            <h2>How are you feeling today?</h2>
            <p>Take a moment for yourself. Every feeling deserves a little space.</p>
          </div>
        </div>
        <MoodPicker
          selectedMood={mood}
          onSelect={(n) => {
            setMood(n);
            setSaved(false);
          }}
        />
        {mood !== null && (
          <div className="tag-question">
            <h3>Would you like to tell us a little more?</h3>
            <p>Optional · choose any feelings that fit</p>
            <div>
              {emotionTags.map((t) => (
                <Tag
                  key={t}
                  active={tags.includes(t)}
                  onClick={() =>
                    setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))
                  }
                >
                  {t}
                </Tag>
              ))}
            </div>
            <label>
              <span>
                A note for yourself <small>Optional</small>
              </span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What might be contributing to this feeling?" />
            </label>
            <div className="checkin-actions">
              <button className="text-btn" onClick={() => { if (mood !== null) onSave({ mood, tags: [], note: "" }); setSaved(true); }}>
                Skip details
              </button>
              <Button onClick={() => { if (mood !== null) onSave({ mood, tags, note }); setSaved(true); }}>
                {saved ? "Saved" : "Save today’s check-in"}
              </Button>
            </div>
          </div>
        )}
        {saved && (
          <div className="recommendation-result">
            <Icon name="check" />
            <div>
              <h3>Thank you for checking in with yourself.</h3>
              <p>
                A three-minute grounding pause might feel supportive right now. It’s only a
                suggestion—you know your day best.
              </p>
            </div>
            <Button
              variant="secondary"
              icon="arrow"
              onClick={() =>
                document.querySelector(".peace-page")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Try grounding
            </Button>
          </div>
        )}
      </section>
      <div className="mood-data-grid">
        <section className="month-card">
          <div className="calendar-head">
            <div>
              <small>YOUR MONTH</small>
              <h2>
                {monthLabel}
              </h2>
            </div>
            <div>
              <button onClick={() => setMonthOffset(monthOffset - 1)}>←</button>
              <button onClick={() => setMonthOffset(monthOffset + 1)}>→</button>
            </div>
          </div>
          <div className="calendar-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <b key={d}>{d}</b>
            ))}
            {Array.from({ length: blankDays }, (_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length: monthDays }, (_, i) => {
              const day = i + 1;
              const checkIn = checkInForDay(day);
              return (
                <button
                  key={day}
                  className={selectedDay === day ? "selected-day" : ""}
                  onClick={() => setSelectedDay(day)}
                >
                  <i>{day}</i>{checkIn && <em>{moods[checkIn.mood].emoji}</em>}
                </button>
              );
            })}
          </div>
          {selectedDay && (
            <div className="day-detail">
              <span>
                {checkInForDay(selectedDay)
                  ? moods[checkInForDay(selectedDay)!.mood].emoji
                  : "—"}
              </span>
              <div>
                <b>{monthLabel} {selectedDay}</b>
                <small>
                  {checkInForDay(selectedDay)
                    ? "Your saved check-in"
                    : "No check-in saved"}
                </small>
              </div>
              {checkInForDay(selectedDay) && <small>{checkInForDay(selectedDay)!.tags.join(" · ") || "Check-in saved"}</small>}
            </div>
          )}
        </section>
        <aside className="pattern-card">
          <small>GENTLE PATTERNS</small>
          <h2>Your recent week</h2>
          <div className="timeline-chart">
            {Array.from({ length: 7 }, (_, i) => {
              const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - 6 + i);
              const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const checkIn = checkIns.find((item) => item.date === key);
              return <span key={key}><i style={{ height: `${checkIn ? 20 + (4 - checkIn.mood) * 18 : 6}%` }} /><small>{day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</small></span>;
            })}
          </div>
          <h3>{checkIns.length ? `${checkIns.length} check-in${checkIns.length === 1 ? "" : "s"} recorded` : "Your patterns start with a check-in"}</h3>
          <p>
            Your records are self-reported feelings, not a clinical measurement. Patterns are
            invitations to reflect, never conclusions about you.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Scenario() {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const responses = [
    "“I understand this matters to you, and I need time to decide what feels right for me.”",
    "Agree immediately to avoid disappointing them.",
    "Leave the conversation without saying anything.",
    "Tell them they never understand you.",
  ];
  return (
    <div className="page scenario-page">
      <PageHeader
        eyebrow="Practice before the moment"
        title="Scenario Simulator"
        text="Explore different responses to real student-life situations—without labels or right-answer pressure."
      />
      <div className="scenario-progress">
        <span>Scenario {step + 1} of 4</span>
        <div>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i <= step ? "active" : ""} />
          ))}
        </div>
      </div>
      <section className="scenario-card">
        <div className="scenario-context">
          <span>FAMILY EXPECTATIONS</span>
          <h2>“Choosing a different career means disappointing the family.”</h2>
          <p>
            You’ve been preparing for a placement your family prefers, but you’re increasingly drawn
            to a different path. When you mention it, the conversation becomes emotional.
          </p>
        </div>
        <div className="scenario-question">
          <Kicker>How might you respond?</Kicker>
          <div>
            {responses.map((r, i) => (
              <button
                key={r}
                className={choice === i ? "selected" : ""}
                onClick={() => setChoice(i)}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                <p>{r}</p>
                {choice === i && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
        {choice !== null && (
          <div className="scenario-feedback">
            <div>
              <Icon name="spark" />
              <span>
                <small>A POSSIBLE LENS</small>
                <h3>This response may create space for both care and autonomy.</h3>
              </span>
            </div>
            <p>
              Family expectations can make independence feel like rejection. A calm “both-and”
              response acknowledges the relationship without abandoning your own decision-making.
            </p>
            <div className="concept-row">
              <Tag>Emotional boundaries</Tag>
              <Tag>Assertive communication</Tag>
              <Tag>Autonomy</Tag>
            </div>
            <div className="feedback-prompt">
              <Icon name="journal" />
              <p>
                <b>Reflect:</b> What would make it feel safer to express a decision that matters to
                you?
              </p>
            </div>
          </div>
        )}
        <div className="scenario-footer">
          <button
            className="text-btn"
            onClick={() => {
              setChoice(null);
              setStep((step + 1) % 4);
            }}
          >
            Try another scenario
          </button>
          <Button
            onClick={() => {
              setChoice(null);
              setStep(Math.min(3, step + 1));
            }}
            disabled={choice === null}
            icon="arrow"
          >
            Continue
          </Button>
        </div>
      </section>
    </div>
  );
}

function Peace() {
  const [exercise, setExercise] = useState<"breathing" | "grounding" | "mindfulness">("breathing");
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState("Breathe in");
  const [groundStep, setGroundStep] = useState(0);
  useEffect(() => {
    if (!running) return;
    const phases = ["Breathe in", "Hold gently", "Breathe out", "Rest"];
    if (elapsed >= duration * 60) {
      setRunning(false);
      setPhase("Rest");
      return;
    }
    const id = window.setTimeout(() => {
      const nextSecond = elapsed + 1;
      setElapsed(nextSecond);
      if (nextSecond % 4 === 0) setPhase(phases[Math.floor(nextSecond / 4) % phases.length]);
    }, 1000);
    return () => clearTimeout(id);
  }, [running, elapsed, duration]);
  return (
    <div className="page peace-page">
      <PageHeader
        eyebrow="A pause belongs here"
        title="Peace Corner"
        text="Nothing to achieve. Choose a small practice and let this moment be enough."
        action={
          <button className="sound-control" type="button" disabled title="Audio tracks are not included in this prototype">
            <Icon name="play" /> Audio unavailable
          </button>
        }
      />
      <div className="peace-tabs">
        <Tag active={exercise === "breathing"} onClick={() => { setExercise("breathing"); setRunning(false); setElapsed(0); }}>
          Guided breathing
        </Tag>
        <Tag active={exercise === "grounding"} onClick={() => { setExercise("grounding"); setRunning(false); setElapsed(0); }}>
          5–4–3–2–1 grounding
        </Tag>
        <Tag active={exercise === "mindfulness"} onClick={() => { setExercise("mindfulness"); setRunning(false); setElapsed(0); }}>
          Mindfulness
        </Tag>
      </div>
      <section className="practice-stage">
        {exercise === "breathing" && (
          <>
            <div className={`breathing-orb ${running ? "running" : ""}`}>
              <span>
                <i />
                <b>{phase}</b>
                <small>{`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} elapsed`}</small>
              </span>
            </div>
            <div className="practice-copy">
              <Kicker>{duration} minute reset</Kicker>
              <h2>Come back to your breath.</h2>
              <p>
                Let the circle guide you. There’s no need to force a deep breath—just follow what
                feels comfortable.
              </p>
              <div className="duration-row">
                <span>Duration</span>
                {["1 min", "3 min", "5 min"].map((d, i) => (
                  <Tag key={d} active={duration === [1, 3, 5][i]} onClick={() => { setDuration([1, 3, 5][i]); setElapsed(0); setRunning(false); }}>
                    {d}
                  </Tag>
                ))}
              </div>
              <Button onClick={() => { if (running) setRunning(false); else { if (elapsed >= duration * 60) { setElapsed(0); setPhase("Breathe in"); } setRunning(true); } }} icon={running ? undefined : "play"}>
                {running ? "Pause practice" : elapsed >= duration * 60 ? "Begin again" : elapsed ? "Resume practice" : "Begin breathing"}
              </Button>
            </div>
          </>
        )}
        {exercise === "grounding" && (
          <>
            <div className="ground-visual">
              <span>{5 - groundStep}</span>
              <small>senses</small>
            </div>
            <div className="practice-copy">
              <Kicker>5–4–3–2–1 grounding</Kicker>
              <h2>
                {
                  [
                    "Notice five things you can see.",
                    "Notice four things you can feel.",
                    "Notice three things you can hear.",
                    "Notice two things you can smell.",
                    "Notice one thing you can taste.",
                  ][groundStep]
                }
              </h2>
              <p>Take your time. Name each one silently or aloud. Ordinary things count.</p>
              <div className="step-dots">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className={i <= groundStep ? "active" : ""} />
                ))}
              </div>
              <Button onClick={() => setGroundStep((groundStep + 1) % 5)} icon="arrow">
                {groundStep === 4 ? "Complete practice" : "Next sense"}
              </Button>
            </div>
          </>
        )}
        {exercise === "mindfulness" && (
          <>
            <div className="mindful-visual">
              <Icon name="leaf" size={64} />
            </div>
            <div className="practice-copy">
              <Kicker>Body awareness · 5 min</Kicker>
              <h2>Notice where you’re holding effort.</h2>
              <p>
                A quiet, audio-free body scan for your jaw, shoulders, hands, and breath. Audio
                never starts automatically.
              </p>
              <Button icon="play" onClick={() => setRunning(!running)}>
                {running ? "Pause guided practice" : "Start guided practice"}
              </Button>
            </div>
          </>
        )}
      </section>
      <div className="peace-library">
        <div className="section-heading">
          <div>
            <Kicker>More ways to rest</Kicker>
            <h2>Choose what feels kind today</h2>
          </div>
        </div>
        <div>
          {[
            ["moon", "Bedtime wind-down", "8 min"],
            ["heart", "Supportive self-talk", "3 min"],
            ["play", "Sufi-inspired calm", "12 min"],
            ["spark", "Gentle countdown", "5 min"],
          ].map((x) => (
            <button
              key={x[1]}
              onClick={() => { const next: "breathing" | "grounding" | "mindfulness" = x[1] === "Bedtime wind-down" ? "mindfulness" : x[1] === "Supportive self-talk" ? "grounding" : "breathing"; setExercise(next); setRunning(false); document.querySelector(".practice-stage")?.scrollIntoView({ behavior: "smooth" }); }}
            >
              <span>
                <Icon name={x[0] as IconName} />
              </span>
              <div>
                <h3>{x[1]}</h3>
                <p>{x[2]} · Audio optional</p>
              </div>
              <Icon name="play" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentLife({ setPage }: { setPage: (page: Page) => void }) {
  const now = useCurrentTime();
  const [tab, setTab] = useState("Academic balance");
  const [tasks, setTasks] = useSavedState("manasika.student.tasks.v1", [
    { text: "Review research notes", done: true },
    { text: "Draft two interview answers", done: false },
    { text: "Take a real lunch break", done: false },
  ]);
  const [newTask, setNewTask] = useState("");
  const addTask = () => {
    if (newTask.trim()) {
      setTasks((items) => [...items, { text: newTask.trim(), done: false }]);
      setNewTask("");
    }
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Practical support for student life"
        title="Make the next step feel smaller."
        text="Simple tools for study, future worries, relationships, and a routine that still has room for you."
      />
      <div className="student-tabs">
        {["Academic balance", "Career & future", "Personal life", "Daily balance"].map((t) => (
          <Tag key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </Tag>
        ))}
      </div>
      <div className="student-layout">
        <section className="planner">
          <div className="planner-head">
            <div>
              <small>YOUR GENTLE PLAN</small>
              <h2>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, one thing at a time</h2>
            </div>
            <span>
              {tasks.filter((t) => t.done).length}/{tasks.length} complete
            </span>
          </div>
          <div className="task-list">
            {tasks.map((t, i) => (
              <label key={i} className={t.done ? "done" : ""}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => setTasks((items) => items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                />
                <span>
                  <Icon name="check" />
                </span>
                <b>{t.text}</b>
                  <button type="button" aria-label={`Remove ${t.text}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setTasks((items) => items.filter((_, j) => j !== i)); }}>
                  <Icon name="trash" />
                </button>
              </label>
            ))}
          </div>
          <div className="add-task">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add one manageable step..."
            />
            <Button variant="secondary" onClick={addTask} icon="plus">
              Add
            </Button>
          </div>
          <div className="break-reminder">
            <Icon name="leaf" />
            <div>
              <b>Study-break reminder</b>
              <p>After 45 minutes, take 10 minutes away from the screen.</p>
            </div>
            <label className="switch">
              <input type="checkbox" defaultChecked />
              <span />
            </label>
          </div>
        </section>
        <aside className="challenge-panel">
          <small>{tab.toUpperCase()}</small>
          <h2>
            {tab === "Career & future"
              ? "Your pace is still progress."
              : tab === "Personal life"
                ? "Care and boundaries can coexist."
                : tab === "Daily balance"
                  ? "A routine should support you."
                  : "Study without disappearing into it."}
          </h2>
          <p>
            {tab === "Academic balance"
              ? "Try a plan that makes room for energy, meals, and uncertainty—not just output."
              : "Choose a short exercise designed for the part of student life that feels heavy today."}
          </p>
          <div className="resource-list">
            {[
              ["spark", "Untangle a big worry", "5 min exercise", "companion"],
              ["journal", "Write a calmer plan", "Reflection prompt", "reflection"],
              ["heart", "Confidence before comparison", "4 min read", "discover"],
            ].map((x) => (
              <button key={x[1]} onClick={() => setPage(x[3] as Page)}>
                <Icon name={x[0] as IconName} />
                <span>
                  <b>{x[1]}</b>
                  <small>{x[2]}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
          <Button onClick={() => setPage("growth")} icon="plus">
            Set a personal goal
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Growth({ checkIns, activity }: { checkIns: MoodCheckIn[]; activity: ActivityItem[] }) {
  const now = useCurrentTime();
  const [goalOpen, setGoalOpen] = useState(false);
  const [goals, setGoals] = useSavedState("manasika.growth.goals.v1", [
    { id: "goal-boundary", text: "Pause before saying yes", done: false },
    { id: "goal-rest", text: "End study by 10:30 PM", done: false },
  ]);
  const [reflections] = useSavedState<ReflectionEntry[]>("manasika.reflections.v1", []);
  const [newGoal, setNewGoal] = useState("");
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCheckIns = checkIns.filter((item) => new Date(`${item.date}T00:00:00`).getTime() >= weekAgo).length;
  const weeklyReflections = reflections.filter((item) => new Date(item.date).getTime() >= weekAgo).length;
  const weeklyMoments = weeklyCheckIns + weeklyReflections;
  const areasExplored = new Set(activity.filter((item) => item.action === "Opened a section").map((item) => item.area)).size;
  return (
    <div className="page">
      <PageHeader
        eyebrow="Your progress, without pressure"
        title="My Growth Journey"
        text="Small moments of awareness count. This is a record of care—not a scorecard."
        action={
          <Button onClick={() => setGoalOpen(true)} icon="plus">
            Set a new goal
          </Button>
        }
      />
      <section className="growth-hero">
        <div>
          <span className="card-icon">
            <Icon name="growth" />
          </span>
          <Kicker>This week</Kicker>
          <h2>{weeklyMoments ? "You took time to understand yourself." : "Your next small moment can start here."}</h2>
          <p>{weeklyMoments ? `You saved ${weeklyMoments} moment${weeklyMoments === 1 ? "" : "s"} this week. Every one is a moment of care.` : "There is no target to meet. A check-in or reflection will appear here when you choose to save one."}</p>
        </div>
        <div className="growth-ring">
          <span>
            <b>{weeklyMoments}</b>
            <small>
              moments
              <br />
              for you
            </small>
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {[
          ["journal", String(reflections.length), "Reflections written"],
          ["book", String(activity.filter((item) => item.area === "discover").length), "Discover visits"],
          ["mood", String(checkIns.length), "Mood check-ins"],
          ["spark", String(areasExplored), "Sections explored"],
        ].map((x) => (
          <article key={x[2]}>
            <Icon name={x[0] as IconName} />
            <b>{x[1]}</b>
            <span>{x[2]}</span>
          </article>
        ))}
      </div>
      <div className="growth-columns">
        <section>
          <div className="section-heading">
            <div>
              <Kicker>In progress</Kicker>
              <h2>Personal goals</h2>
            </div>
          </div>
          <div className="goal-list">
            {goals.map((goal) => (
              <article key={goal.id} className={goal.done ? "completed" : ""}>
                <button aria-label={goal.done ? "Mark goal in progress" : "Complete goal"} aria-pressed={goal.done} onClick={() => setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, done: !item.done } : item))}>
                  <Icon name="check" />
                </button>
                <div>
                  <h3>{goal.text}</h3>
                  <p>{goal.done ? "Completed · choose your next gentle step" : "In progress · take it at your own pace"}</p>
                  <span>
                    <i style={{ width: goal.done ? "100%" : "0%" }} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section>
          <div className="section-heading">
            <div>
              <Kicker>Recent moments</Kicker>
              <h2>Milestones</h2>
            </div>
          </div>
          <div className="milestone-list">
            {activity.slice(0, 3).map((item) => <article key={item.id}>
              <span>
                <Icon name="leaf" />
              </span>
              <div>
                <small>{formatLocalDate(item.date, { dateStyle: "medium", timeStyle: "short" })}</small>
                <h3>{item.action}</h3>
                <p>{item.area} · recorded on this device</p>
              </div>
            </article>)}
            {activity.length === 0 && <p>Your saved moments will appear here.</p>}
          </div>
        </section>
      </div>
      {goalOpen && (
        <Modal title="A small goal for yourself" close={() => setGoalOpen(false)}>
          <p>Choose something gentle, specific, and within your control.</p>
          <label className="field">
            <span>My goal</span>
            <input
              autoFocus
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="For example: Take lunch away from my desk"
            />
          </label>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setGoalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newGoal.trim()) setGoals((items) => [...items, { id: crypto.randomUUID(), text: newGoal.trim(), done: false }]);
                setGoalOpen(false);
                setNewGoal("");
              }}
            >
              Save goal
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Creative() {
  const [tab, setTab] = useState("My Art");
  const [story, setStory] = useState("");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [generatedStory, setGeneratedStory] = useState("");
  const [textGenerating, setTextGenerating] = useState<"music" | "story" | null>(null);
  const [textGenerationStatus, setTextGenerationStatus] = useState<"checking" | "ready" | "missing-key" | "offline">("checking");
  const [textGenerationError, setTextGenerationError] = useState("");
  const [saved, setSaved] = useState(false);
  const artPrompts = [
    "If today had a colour and shape, what would it be?",
    "Draw a small place where you would feel safe to rest.",
    "Turn one feeling from today into a landscape.",
    "Make an abstract picture of a fresh start.",
    "Imagine a tiny garden that grows around something you love.",
  ];
  const [artPromptIndex, setArtPromptIndex] = useState(0);
  const [artPrompt, setArtPrompt] = useState(artPrompts[0]);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicNote, setMusicNote] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("Build a story outline with a driven protagonist, a believable antagonist, a central conflict, and a sequence of plot beats leading to a meaningful resolution.");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [mediaItems, setMediaItems] = useState<CreativeMediaItem[]>([]);
  const [mediaConfigured, setMediaConfigured] = useState(false);
  const [textGenerationConfigured, setTextGenerationConfigured] = useState(false);
  const [mediaAvailable, setMediaAvailable] = useState(false);
  const [mediaArchiveDays, setMediaArchiveDays] = useState(30);
  const [mediaGenerating, setMediaGenerating] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [trainingConsentSaving, setTrainingConsentSaving] = useState(false);
  const [trainingConsentMessage, setTrainingConsentMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getCreativePrompt("image", 0),
      getCreativePrompt("music", 0),
      getCreativePrompt("story", 0),
    ]).then(([image, music, writing]) => {
      if (!active) return;
      if (image) setArtPrompt(image);
      if (music) {
        setMusicPrompt(music);
        setMusicNote((current) => current || music);
      }
      if (writing) setStoryPrompt(writing);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await startCreativeSession();
      const [status, items, training] = await Promise.all([getCreativeMediaStatus(), listCreativeMedia(), getCreativeTrainingConsent()]);
      if (!active) return;
      setMediaAvailable(true);
      setMediaConfigured(status.providerConfigured);
      setTextGenerationConfigured(status.textGenerationConfigured);
      setTextGenerationStatus(status.textGenerationConfigured ? "ready" : "missing-key");
      setMediaArchiveDays(status.archiveDays);
      setMediaItems(items);
      setTrainingConsent(training.enabled);
      if (!status.providerConfigured) setMediaError("Image generation needs a server-side provider key.");
    })().catch(() => {
      if (active) {
        setMediaError("The media backend is not connected to this site yet.");
        setTextGenerationStatus("offline");
      }
    });
    return () => { active = false; };
  }, []);

  const createNextArtPrompt = () => {
    const nextIndex = artPromptIndex + 1;
    setArtPromptIndex(nextIndex);
    setSaved(false);
    getCreativePrompt("image", nextIndex).then((prompt) => {
      if (prompt) setArtPrompt(prompt);
      else setArtPrompt(artPrompts[nextIndex % artPrompts.length]);
    });
  };

  const generateMedia = async () => {
    if (!mediaConfigured || mediaGenerating || !artPrompt.trim()) return;
    setMediaGenerating(true);
    setMediaError("");
    try {
      const item = await generateCreativeImage(artPrompt);
      setMediaItems((items) => [item, ...items.filter((existing) => existing.id !== item.id)]);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "The image could not be generated. Please try again.");
    } finally {
      setMediaGenerating(false);
    }
  };

  const generateCreativeText = async (medium: "music" | "story") => {
    const prompt = medium === "music" ? (musicNote.trim() || musicPrompt.trim()) : storyPrompt.trim();
    if (!textGenerationConfigured || textGenerating || prompt.length < 3) return;
    setTextGenerating(medium);
    setTextGenerationError("");
    try {
      const result = await requestCreativeText(medium, prompt);
      if (medium === "music") setGeneratedLyrics(result.content);
      else {
        setGeneratedStory(result.content);
        setStory(result.content);
        setSaved(false);
      }
    } catch (error) {
      setTextGenerationError(error instanceof Error ? error.message : "Text generation could not be completed. Please try again.");
    } finally {
      setTextGenerating(null);
    }
  };

  const removeMedia = async (item: CreativeMediaItem) => {
    try {
      await deleteCreativeMedia(item.id);
      setMediaItems((items) => items.filter((existing) => existing.id !== item.id));
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "This image could not be removed.");
    }
  };

  const saveArtwork = async () => {
    const [didSave, didPersist, didTrainArtwork] = await Promise.all([
      saveCreativeOutput({
      kind: "image",
      prompt: artPrompt,
      content: "",
      ...(artworkFile ? { file: artworkFile, fileName: artworkFile.name, mimeType: artworkFile.type } : {}),
      }),
      saveCreativeInput("image", artPrompt).then(() => true).catch(() => false),
      trainingConsent && artworkFile ? saveTrainingArtwork(artworkFile, artPrompt).then(() => true).catch(() => false) : Promise.resolve(true),
    ]);
    setSaved(didSave);
    setMediaError(!didPersist ? "Saved on this device; the permanent archive is currently unavailable."
      : !didTrainArtwork ? "Saved privately, but this artwork could not be added to the opt-in example database." : "");
  };

  const updateTrainingConsent = async (enabled: boolean) => {
    setTrainingConsentSaving(true);
    setTrainingConsentMessage("");
    try {
      await setCreativeTrainingConsent(enabled);
      setTrainingConsent(enabled);
      setTrainingConsentMessage(enabled
        ? "Sharing is on. New saved prompts and creations can guide future generations."
        : "Sharing is off. Your contributed examples and stored training images were removed.");
    } catch (error) {
      setTrainingConsentMessage(error instanceof Error ? error.message : "Your sharing preference could not be saved.");
    } finally {
      setTrainingConsentSaving(false);
    }
  };

  const saveMusicNote = async () => {
    if (!musicNote.trim()) return;
    const [didSave, didPersist] = await Promise.all([
      saveCreativeOutput({
      kind: "music",
      prompt: musicPrompt || musicNote,
      content: musicNote,
      ...(audioFile ? { file: audioFile, fileName: audioFile.name, mimeType: audioFile.type } : {}),
      }),
      saveCreativeInput("music", musicPrompt || musicNote, musicNote).then(() => true).catch(() => false),
    ]);
    setSaved(didSave);
    window.alert(didSave && didPersist ? "Your music note was saved privately." : didSave ? "Saved in this browser; the permanent archive is currently unavailable." : "This browser could not save the music note.");
  };

  const saveStory = async () => {
    if (!story.trim()) return;
    const [didSave, didPersist] = await Promise.all([
      saveCreativeOutput({ kind: "story", prompt: storyPrompt, content: story }),
      saveCreativeInput("story", storyPrompt, story).then(() => true).catch(() => false),
    ]);
    setSaved(didSave);
    if (!didPersist) window.alert("Your story is saved in this browser; the permanent archive is currently unavailable.");
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Create without performing"
        title="My Creative Space"
        text="Make something just for you. Everything here stays in your private collection."
        action={
          <span className="privacy-pill">
            <Icon name="lock" />
            Never shared publicly
          </span>
        }
      />
      <div className="creative-tabs">
        {["My Art", "My Music", "My Stories"].map((t) => (
          <button className={tab === t ? "active" : ""} onClick={() => { setTab(t); setSaved(false); }} key={t}>
            {t === "My Art" ? (
              <Icon name="palette" />
            ) : t === "My Music" ? (
              <Icon name="play" />
            ) : (
              <Icon name="journal" />
            )}
            <span>{t}</span>
          </button>
        ))}
      </div>
      <div className="creative-training-optin">
        <label>
          <input type="checkbox" checked={trainingConsent} disabled={trainingConsentSaving || !mediaAvailable}
            onChange={(event) => void updateTrainingConsent(event.target.checked)} />
          <span><strong>Help improve future creations</strong><small>Optional: saved prompts and notes, generated lyrics, stories and images, and artwork you save can guide future generations for everyone. Turn this off to remove your contributions. Avoid personal details.</small></span>
        </label>
        {trainingConsentMessage && <p role="status">{trainingConsentMessage}</p>}
      </div>
      {tab === "My Art" && (
        <>
        <div className="creative-layout">
          <section className="creation-card">
            <div className="canvas">
              <div className="canvas-art">
                <span />
                <i />
                <b />
              </div>
              <p>Your private canvas</p>
            </div>
            <div className="creation-actions">
              <label className="upload-btn">
                <input type="file" accept="image/*" onChange={(event) => setArtworkFile(event.target.files?.[0] ?? null)} />
                <Icon name="plus" /> Upload artwork
              </label>
              <Button onClick={saveArtwork}>Save to gallery</Button>
            </div>
            {saved && (
              <span className="saved">
                <Icon name="check" /> Saved to your private gallery
              </span>
            )}
          </section>
          <aside className="creative-prompt">
            <Icon name="spark" />
            <small>CREATIVE PROMPT</small>
            <h2>Your next creation</h2>
            <label className="creative-prompt-field">
              <span>Use or edit this prompt</span>
              <textarea
                aria-label="Creative prompt for your next artwork"
                value={artPrompt}
                onChange={(event) => { setArtPrompt(event.target.value); setSaved(false); }}
                rows={4}
              />
            </label>
            <p>
              It can be messy, unfinished, abstract, or quiet. Prompts are sent to the image service; generated images are kept in a temporary private archive for up to {mediaArchiveDays} days. On Render Free, the archive may clear when the service sleeps, restarts, or redeploys.
            </p>
            <Button
              variant="secondary"
              onClick={createNextArtPrompt}
            >
              New prompt
            </Button>
            <Button onClick={generateMedia} disabled={!mediaAvailable || !mediaConfigured || mediaGenerating} icon="spark">
              {mediaGenerating ? "Creating your image…" : "Generate AI image"}
            </Button>
            {mediaError && <p className="creative-media-status" role="status">{mediaError}</p>}
          </aside>
        </div>
        <section className="creative-media-section" aria-labelledby="creative-media-title">
          <div className="creative-media-heading">
            <div>
              <Kicker>AI MEDIA GENERATION</Kicker>
              <h2 id="creative-media-title">Your saved creations</h2>
              <p>Private to this browser account · temporary archive up to {mediaArchiveDays} days</p>
            </div>
            {mediaGenerating && <span className="creative-media-status" role="status">Creating a refined image from your prompt…</span>}
          </div>
          {mediaItems.length ? (
            <div className="creative-media-grid">
              {mediaItems.map((item) => (
                <article className="creative-media-card" key={item.id}>
                  <img src={item.url} alt={`Generated artwork: ${item.prompt.slice(0, 120)}`} loading="lazy" />
                  <div>
                    <small>{new Date(item.createdAt).toLocaleString()} · {item.model}</small>
                    <p>{item.prompt}</p>
                    <button type="button" onClick={() => removeMedia(item)} aria-label="Delete saved image"><Icon name="trash" /> Remove</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="creative-media-empty"><Icon name="spark" /><p>Generated images will appear here after your first creation.</p></div>
          )}
        </section>
        </>
      )}
      {tab === "My Music" && (
        <div className="creative-layout">
          <section className="creation-card music-journal">
            <span className="record">
              <Icon name="play" size={30} />
            </span>
            <h2>Capture a sound or idea</h2>
            <p>
              Microphone access is requested only when you choose to record. Nothing is recorded
              automatically.
            </p>
            <Button
              onClick={() => alert("Prototype: microphone permission would be requested here.")}
              icon="play"
            >
              Start recording
            </Button>
            <label className="upload-btn">
              <input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} />
              <Icon name="plus" /> Upload original audio
            </label>
          </section>
          <aside className="creative-prompt">
            <Kicker>Lyrics & ideas</Kicker>
            <textarea
              value={musicNote}
              onChange={(event) => { setMusicNote(event.target.value); setSaved(false); }}
              placeholder={musicPrompt || "A line, a rhythm, a feeling..."}
            />
            <Button
              variant="secondary"
              onClick={saveMusicNote}
            >
              Save note
            </Button>
            <Button onClick={() => generateCreativeText("music")} disabled={!textGenerationConfigured || textGenerating !== null} icon="spark">
              {textGenerating === "music" ? "Writing lyrics…" : "Generate lyrics"}
            </Button>
            <label className="creative-prompt-field">
              <span>Generated lyrics</span>
              <textarea aria-label="Generated lyrics" value={generatedLyrics} readOnly rows={8} placeholder="Your generated lyrics will appear here." />
            </label>
            {textGenerationStatus === "missing-key" && <p className="creative-media-status" role="status">Lyrics generation needs GROQ_API_KEY on the backend.</p>}
            {textGenerationStatus === "offline" && <p className="creative-media-status" role="status">The writing service is not connected to this site yet.</p>}
            {textGenerationError && <p className="creative-media-status" role="alert">{textGenerationError}</p>}
          </aside>
        </div>
      )}
      {tab === "My Stories" && (
        <div className="creative-layout">
          <section className="creation-card story-editor">
            <input placeholder="Untitled story" />
            <textarea
              value={story}
              onChange={(e) => {
                setStory(e.target.value);
                setSaved(false);
              }}
              placeholder="Begin with a moment you remember clearly..."
            />
            <div>
              <span>{story.split(/\s+/).filter(Boolean).length} words</span>
              <Button onClick={saveStory} disabled={!story.trim()}>
                {saved ? "Saved privately" : "Save story"}
              </Button>
            </div>
          </section>
          <aside className="creative-prompt">
            <Icon name="journal" />
            <small>WRITING PROMPT</small>
            <h2>{storyPrompt}</h2>
            <p>Fiction, memory, fragments—any form is welcome.</p>
            <Button onClick={() => generateCreativeText("story")} disabled={!textGenerationConfigured || textGenerating !== null} icon="spark">
              {textGenerating === "story" ? "Writing your story…" : "Generate story"}
            </Button>
            <label className="creative-prompt-field">
              <span>Generated story</span>
              <textarea aria-label="Generated story" value={generatedStory} readOnly rows={10} placeholder="Your generated story will appear here." />
            </label>
            {textGenerationStatus === "missing-key" && <p className="creative-media-status" role="status">Story generation needs GROQ_API_KEY on the backend.</p>}
            {textGenerationStatus === "offline" && <p className="creative-media-status" role="status">The writing service is not connected to this site yet.</p>}
            {textGenerationError && <p className="creative-media-status" role="alert">{textGenerationError}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}

function Cosmic({ setPage }: { setPage: (p: Page) => void }) {
  const now = useCurrentTime();
  const [sign, setSign] = useSavedState<ZodiacSign>("manasika.cosmic.sign.v1", "Libra");
  const [birthDate, setBirthDate] = useSavedState("manasika.cosmic.birthdate.v1", "");
  const [savedAffirmations, setSavedAffirmations] = useSavedState<string[]>("manasika.cosmic.affirmations.v1", []);
  const [otherSign, setOtherSign] = useState<ZodiacSign>("Aries");
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [datasetReflection, setDatasetReflection] = useState<string | null>(null);
  const signInfo = zodiacInfo[sign];
  const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  const localDay = localDateKey(now);
  const dailyMessage = datasetReflection || signInfo.messages[(dayNumber + zodiacSigns.indexOf(sign)) % signInfo.messages.length];
  useEffect(() => {
    let active = true;
    setDatasetReflection(null);
    getDatasetReflection(sign, localDay).then((reflection) => {
      if (active) setDatasetReflection(reflection);
    });
    return () => { active = false; };
  }, [sign, localDay]);
  const affirmation = `I can move at my own pace; ${signInfo.traits[0].toLowerCase()} can begin with one small choice.`;
  const birthdayToday = !!birthDate && birthDate.slice(5) === localDateKey(now).slice(5);
  const compatibilityText = zodiacInfo[otherSign].element === signInfo.element
    ? `Both signs are traditionally associated with ${signInfo.element.toLowerCase()} energy. You might explore shared communication styles while staying curious about individual differences.`
    : `${sign} and ${otherSign} are traditionally associated with different elements. A playful conversation can explore how different perspectives complement or challenge one another.`;
  return (
    <div className="page cosmic-page">
      <div className="cosmic-sky">
        <span className="cosmic-stars">· ✦　˚　✧　·　✦　˚　✧　·</span>
        <Kicker>Cosmic Corner</Kicker>
        <h1>A little wonder for your day.</h1>
        <small>{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · local date</small>
        <p>
          Positive astrology-inspired reflection, offered for entertainment—not as psychology,
          prediction, or life advice.
        </p>
        <div className="cosmic-message">
          <span>{signInfo.symbol}</span>
          <div>
            <small>TODAY’S MESSAGE FOR {sign.toUpperCase()}</small>
            <h2>{dailyMessage}</h2>
            <p>This gentle prompt changes with the selected sign and your device’s local date.</p>
          </div>
        </div>
      </div>
      <section className="zodiac-profile">
        <div className="zodiac-selector">
          <Kicker>My zodiac profile</Kicker>
          <h2>Meet your celestial archetype</h2>
          <p>
            Select your sign, or use your date of birth. These are playful traditional
            interpretations.
          </p>
          <label className="field">
            <span>Your zodiac sign</span>
            <select value={sign} onChange={(e) => setSign(e.target.value as ZodiacSign)}>
              {zodiacSigns.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date of birth <small>Optional · stored on this device</small></span>
            <input type="date" max={localDateKey(now)} value={birthDate} onChange={(event) => { const value = event.target.value; setBirthDate(value); const derived = zodiacFromBirthDate(value); if (derived) setSign(derived); }} />
          </label>
          <Button
            variant="cosmic"
            icon="spark"
            onClick={() =>
              document.querySelector(".zodiac-card")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Explore {sign}
          </Button>
        </div>
        <div className="zodiac-card">
          <div className="constellation">
            ✦<i />✧<i />✦<i />·
          </div>
          <span className="big-zodiac">
            {signInfo.symbol}
          </span>
          <small>{sign.toUpperCase()} · {signInfo.element.toUpperCase()}</small>
          <h2>{signInfo.archetype}</h2>
          <p>
            Traditionally, {sign} is associated with {signInfo.traits.map((trait) => trait.toLowerCase()).join(", ")}. This is a cultural reflection, not a personality assessment.
          </p>
          <div>
            {signInfo.traits.map((trait) => <Tag key={trait}>{trait}</Tag>)}
          </div>
        </div>
      </section>
      <section className="affirmation-card">
        <span>☾</span>
        <div>
          <small>COSMIC AFFIRMATION</small>
          <h2>“{affirmation}”</h2>
          <Button
            variant="secondary"
            onClick={() => setSavedAffirmations((items) => items.includes(affirmation) ? items.filter((item) => item !== affirmation) : [affirmation, ...items])}
          >
            {savedAffirmations.includes(affirmation) ? "Saved privately · remove" : "Save affirmation"}
          </Button>
        </div>
      </section>
      <section className="cosmic-bottom">
        <article>
          <Icon name="heart" />
          <h3>Friendship compatibility</h3>
          <p>
            Explore traditional communication styles and shared interests—never relationship
            outcomes.
          </p>
          <Button variant="ghost" onClick={() => setCompatibilityOpen(true)}>
            Choose two signs
          </Button>
        </article>
        <article>
          <Icon name="spark" />
          <h3>Birthday constellation</h3>
          <p>{birthdayToday ? `Happy birthday, ${sign}! May the year ahead make room for curiosity, rest, and your own pace.` : "A positive greeting, affirmation, and reflection for your next year."}</p>
          <Button variant="ghost" onClick={() => setCelebration((shown) => !shown)}>{celebration ? "Hide celebration" : birthdayToday ? "Open birthday note" : "Preview celebration"}</Button>
          {celebration && <p className="cosmic-celebration">Happy birthday, {sign}! May the year ahead make room for curiosity, rest, and your own pace.</p>}
        </article>
      </section>
      <section className="cosmic-tools">
        <Kicker>Explore the sky</Kicker>
        <h2>Three new ways to wander</h2>
        <p>Browse the zodiac library, draw a reflective tarot card, or explore how ideas connect across the supplied astrology collections.</p>
        <div className="cosmic-tool-grid">
          <article><span className="cosmic-tool-mark">✧</span><h3>Zodiac atlas</h3><p>Sign profiles, dataset notes on transits, retrogrades, lunar and solar themes.</p><Button variant="ghost" onClick={() => setPage("zodiac-atlas")}>Open zodiac atlas</Button></article>
          <article><span className="cosmic-tool-mark">☾</span><h3>Tarot reflection</h3><p>Explore a card, its traditional symbolism, and a gentle reflection prompt.</p><Button variant="ghost" onClick={() => setPage("tarot")}>Visit tarot</Button></article>
          <article><span className="cosmic-tool-mark">✦</span><h3>Astrology knowledge map</h3><p>Follow a spherical map of concepts appearing together in the provided datasets.</p><Button variant="ghost" onClick={() => setPage("astro-graph")}>Explore the map</Button></article>
        </div>
      </section>
      {compatibilityOpen && <Modal title="Friendship communication styles" close={() => setCompatibilityOpen(false)}><p>This is a playful, traditional astrology reflection—not a measure of compatibility or an outcome forecast.</p><label className="field"><span>Compare {sign} with</span><select value={otherSign} onChange={(event) => setOtherSign(event.target.value as ZodiacSign)}>{zodiacSigns.map((item) => <option key={item}>{item}</option>)}</select></label><div className="recommendation-result"><Icon name="heart" /><div><h3>{sign} + {otherSign}</h3><p>{compatibilityText}</p></div></div><div className="modal-actions"><Button onClick={() => setCompatibilityOpen(false)}>Done</Button></div></Modal>}
    </div>
  );
}

function CosmicSubPage({ title, subtitle, children, setPage }: { title: string; subtitle: string; children: React.ReactNode; setPage: (p: Page) => void }) {
  return <div className="page cosmic-page cosmic-subpage"><header className="cosmic-subhead"><Button variant="ghost" onClick={() => setPage("cosmic")} icon="arrow">Cosmic Corner</Button><Kicker>Cosmic Corner</Kicker><h1>{title}</h1><p>{subtitle}</p></header>{children}</div>;
}

function ZodiacAtlas({ setPage }: { setPage: (p: Page) => void }) {
  const [sign, setSign] = useSavedState<ZodiacSign>("manasika.cosmic.sign.v1", "Libra");
  const [library, setLibrary] = useState<AstrologyLibrary | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  useEffect(() => { let live = true; loadAstrologyLibrary().then((value) => live && setLibrary(value)).catch(() => live && setError("The astrology reference could not be loaded. Please refresh and try again.")); return () => { live = false; }; }, []);
  const visible = (library?.records || []).filter((record) => {
    const source = record.source || "";
    const category = String(record.category || "").toLowerCase();
    const allText = `${record.title || record.name || ""} ${record.planet || ""} ${record.zodiac_sign || ""} ${record.aspect || ""} ${record.event || ""} ${record.category || ""} ${record.traditional_interpretation || ""} ${record.growth_or_reframing || ""}`.toLowerCase();
    const kindMatch = filter === "All" || (filter === "Transits" ? source.includes("transit") && category !== "retrograde" : filter === "Retrogrades" ? category.includes("retrograde") || allText.includes("retrograde") : filter === "Natal" ? source.includes("natal") : source.includes("lunar") || source.includes("solar"));
    const signText = String(record.zodiac_sign || "").toLowerCase();
    const signMatch = !signText || signText.includes(sign.toLowerCase()) || allText.includes(sign.toLowerCase());
    return kindMatch && signMatch && (!query || allText.includes(query.toLowerCase()));
  });
  const info = zodiacInfo[sign];
  return <CosmicSubPage setPage={setPage} title="The zodiac atlas" subtitle="Profiles and reflection notes gathered from the added astrology collections.">
    <div className="zodiac-atlas-layout"><section className="zodiac-atlas-grid" aria-label="Choose a zodiac sign">{zodiacSigns.map((item) => <button key={item} className={`zodiac-atlas-tile ${sign === item ? "selected" : ""}`} onClick={() => { setSign(item); setLimit(8); }}><span>{zodiacInfo[item].symbol}</span><b>{item}</b><small>{zodiacInfo[item].element}</small></button>)}</section>
    <section className="cosmic-reference-panel"><div className="cosmic-reference-profile"><span className="big-zodiac">{info.symbol}</span><div><Kicker>{sign} · {info.element}</Kicker><h2>{info.archetype}</h2><p>Traditional cultural associations: {info.traits.join(" · ")}. A reflective profile, not a personality assessment.</p></div></div>
      <div className="cosmic-reference-controls"><div className="tag-wrap">{["All", "Transits", "Retrogrades", "Natal", "Lunar & solar"].map((item) => <Tag key={item} active={filter === item} onClick={() => { setFilter(item); setLimit(8); }}>{item}</Tag>)}</div><input aria-label="Search astrology notes" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(8); }} placeholder="Search planets, houses, themes…" /></div>
      <p className="cosmic-data-note">Dataset notes are symbolic interpretations, not live planetary calculations. They are not predictions or advice.</p>
      {error && <p role="status" className="cosmic-error">{error}</p>}
      {!library && !error && <p>Opening the astrology library…</p>}
      {library && <><small className="cosmic-count">Showing {Math.min(limit, visible.length)} of {visible.length} matching notes · {library.record_count.toLocaleString()} records in library</small><div className="cosmic-record-list">{visible.slice(0, limit).map((record, index) => <article key={`${record.source}-${record.source_row}-${index}`}><small>{String(record.source).replaceAll("_", " ")} · {String(record.category || "reference").replaceAll("_", " ")}</small><h3>{String(record.title || record.name || record.event || `${record.planet || "Celestial"} reflection`)}</h3><p>{String(record.traditional_interpretation || record.emotional_themes || record.growth_or_reframing || record.interpretation || record.description || record.astronomical_fact || "A reference entry from the supplied astrology dataset.")}</p>{(record.planet || record.house || record.aspect) && <div className="tag-wrap">{record.planet && <Tag>{String(record.planet)}</Tag>}{record.house && <Tag>House {String(record.house)}</Tag>}{record.aspect && <Tag>{String(record.aspect)}</Tag>}</div>}</article>)}</div>{visible.length > limit && <Button variant="secondary" onClick={() => setLimit((n) => n + 8)}>Show more notes</Button>}{visible.length === 0 && <p>No matching dataset notes. Try another sign, category, or search.</p>}</>}
    </section></div>
  </CosmicSubPage>;
}

function TarotZone({ setPage }: { setPage: (p: Page) => void }) {
  const [library, setLibrary] = useState<TarotLibrary | null>(null);
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [isReversed, setIsReversed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let live = true; loadTarotLibrary().then((value) => live && setLibrary(value)).catch(() => live && setError("The tarot library could not be loaded. Please refresh and try again.")); return () => { live = false; }; }, []);
  const draw = () => { if (!library?.cards.length || drawing) return; setDrawing(true); window.setTimeout(() => { const card = library.cards[Math.floor(Math.random() * library.cards.length)]; setSelected(card); setIsReversed(Math.random() < .35); setDrawing(false); }, 650); };
  return <CosmicSubPage setPage={setPage} title="A tarot moment" subtitle="A small, playful card draw for reflection. It does not predict the future.">
    <section className="tarot-zone"><div className={`tarot-deck ${drawing ? "shuffling" : ""}`} aria-label={drawing ? "Shuffling tarot deck" : "A deck of tarot cards"}>{[0,1,2,3,4,5,6].map((item) => <div className="tarot-back" key={item} style={{ "--card-x": `${(item - 3) * 14}px`, "--card-rotation": `${(item - 3) * 7}deg` } as React.CSSProperties}><span>✦<br/>☾</span></div>)}</div><div className="tarot-actions"><Kicker>Pause, breathe, and draw</Kicker><h2>What might be useful to reflect on?</h2><p>Choose a card as a creative prompt. Keep what resonates; leave the rest.</p><Button variant="cosmic" icon="spark" onClick={draw} disabled={!library || drawing}>{drawing ? "Shuffling…" : selected ? "Draw another card" : "Draw a card"}</Button>{library && <small>{library.card_count} illustrated-reference cards · meanings from the supplied tarot collection</small>}{error && <p role="status" className="cosmic-error">{error}</p>}</div>
    {selected && <article className={`tarot-reveal ${isReversed ? "reversed" : ""}`} aria-live="polite"><div className="tarot-card-face"><small>{selected.arcana}{selected.suit ? ` · ${selected.suit}` : ""}</small><span>{selected.name}</span><i>✦</i></div><div><Kicker>{isReversed ? "Reversed" : "Upright"} · reflective reading</Kicker><h2>{selected.name}</h2><p>{isReversed ? selected.reversed : selected.upright}</p><h3>Traditional symbolism</h3><p>{selected.traditionalSymbolism}</p><h3>A question to sit with</h3><p>{selected.reflection}</p><h3>A gentle next step</h3><p>{selected.action}</p><small>For personal reflection and entertainment. Tarot is not a substitute for professional, medical, financial, or legal guidance.</small></div></article>}
    <footer className="tarot-source">Traditional reference: <a href="https://www.gutenberg.org/ebooks/43548" target="_blank" rel="noreferrer">A. E. Waite, <i>The Pictorial Key to the Tarot</i> (Project Gutenberg)</a>. Dataset interpretations are presented in brief paraphrase.</footer></section>
  </CosmicSubPage>;
}

function AstrologyGraph({ setPage }: { setPage: (p: Page) => void }) {
  const [graph, setGraph] = useState<CosmicGraph | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [kind, setKind] = useState("All");
  const [error, setError] = useState("");
  useEffect(() => { let live = true; loadCosmicGraph().then((value) => live && setGraph(value)).catch(() => live && setError("The knowledge map could not be loaded. Please refresh and try again.")); return () => { live = false; }; }, []);
  const nodes = useMemo(() => {
    if (!graph) return [] as GraphNode[];
    const preferred = graph.nodes.filter((node) => ["sign", "planet", "house", "aspect", "theme", "event", "category", "phase", "dataset"].includes(node.kind.toLowerCase()));
    const unique = new Map<string, GraphNode>();
    preferred.sort((a,b) => (b.count - a.count) || a.label.localeCompare(b.label)).forEach((node) => { if (!unique.has(node.id)) unique.set(node.id, node); });
    const chosen = [...unique.values()];
    const byKind = (wanted: string, count: number) => chosen.filter((node) => node.kind.toLowerCase() === wanted).slice(0, count);
    return kind === "All" ? [...byKind("sign",12), ...byKind("planet",14), ...byKind("house",12), ...byKind("aspect",10), ...byKind("theme",10), ...byKind("event",8), ...byKind("phase",6), ...byKind("category",6), ...byKind("dataset",4)].slice(0,72) : byKind(kind === "Zodiac" ? "sign" : kind.toLowerCase(), 48);
  }, [graph, kind]);
  const points = useMemo(() => nodes.map((node,index) => { const count = Math.max(nodes.length,1); const y = 1 - (index / Math.max(count - 1,1)) * 2; const radius = Math.sqrt(1-y*y); const theta = Math.PI * (3 - Math.sqrt(5)) * index; const x = Math.cos(theta)*radius; const z = Math.sin(theta)*radius; const perspective = 1 / (1.5 - z*.35); return { node, x: 360 + x * 265 * perspective, y: 255 + y * 195 * perspective, depth:z, size: Math.max(3.5, Math.min(9, 3.5 + Math.log2(node.count+1))) }; }), [nodes]);
  const byId = new Map(points.map((point) => [point.node.id, point]));
  const selected = graph?.nodes.find((node) => node.id === selectedId) || null;
  const links = (graph?.edges || []).filter((edge) => byId.has(edge.source) && byId.has(edge.target)).sort((a,b) => b.count-a.count).slice(0,180);
  const related = selected ? (graph?.edges || []).filter((edge) => edge.source === selected.id || edge.target === selected.id).map((edge) => graph?.nodes.find((node) => node.id === (edge.source === selected.id ? edge.target : edge.source))).filter((node): node is GraphNode => !!node).sort((a,b) => b.count-a.count).slice(0,6) : [];
  return <CosmicSubPage setPage={setPage} title="The astrology knowledge map" subtitle="A first, explorable map of concepts appearing together in the supplied astrology datasets.">
    <section className="cosmic-graph-panel"><div className="cosmic-graph-heading"><div><Kicker>Dataset constellation</Kicker><h2>Follow a thread of meaning</h2><p>Each line represents concepts found together in source records. It does not imply a causal or predictive relationship.</p></div><div className="tag-wrap">{["All", "Zodiac", "Planet", "House", "Aspect", "Theme", "Event", "Phase"].map((item) => <Tag key={item} active={kind === item} onClick={() => setKind(item)}>{item}</Tag>)}</div></div>
    {error && <p role="status" className="cosmic-error">{error}</p>}{!graph && !error && <p>Gathering the constellation…</p>}
    {graph && <div className="cosmic-graph-layout"><div className="cosmic-graph-canvas"><svg viewBox="0 0 720 520" role="img" aria-label="Interactive spherical astrology knowledge graph"><defs><radialGradient id="cosmic-sphere" cx="38%" cy="30%"><stop offset="0" stopColor="#fffdf8"/><stop offset="1" stopColor="#e5e5f2"/></radialGradient></defs><circle cx="360" cy="255" r="210" fill="url(#cosmic-sphere)" stroke="#b4a7c4" strokeWidth="1.5"/><ellipse cx="360" cy="255" rx="210" ry="68" fill="none" stroke="#d1c8d9"/><ellipse cx="360" cy="255" rx="210" ry="134" fill="none" stroke="#d1c8d9"/><ellipse cx="360" cy="255" rx="68" ry="210" fill="none" stroke="#d1c8d9"/><ellipse cx="360" cy="255" rx="134" ry="210" fill="none" stroke="#d1c8d9"/>{links.map((edge,index) => { const a=byId.get(edge.source), b=byId.get(edge.target); if(!a||!b)return null; return <line key={`${edge.source}-${edge.target}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#aa9bb8" strokeOpacity={Math.min(.12+edge.count*.04,.4)} strokeWidth=".8"/>; })}{points.map(({node,x,y,depth,size}) => <g key={node.id} className="cosmic-graph-node" role="button" tabIndex={0} aria-label={`${node.label}, ${node.kind}, ${node.count} dataset mentions`} onClick={() => setSelectedId(node.id)} onKeyDown={(event) => { if(event.key === "Enter" || event.key === " "){ event.preventDefault(); setSelectedId(node.id); } }}><circle cx={x} cy={y} r={size+6} fill={node.kind === "zodiac" ? "#e8c895" : node.kind === "planet" ? "#b8b1cd" : "#9bbab0"} opacity={Math.max(.18, .4+depth*.3)}/><circle cx={x} cy={y} r={size} fill={node.kind === "zodiac" ? "#a87e4a" : node.kind === "planet" ? "#756788" : "#527970"}/>{(size >= 6 || selectedId === node.id) && <text x={x} y={y-size-5} textAnchor="middle">{node.label.length > 18 ? `${node.label.slice(0,17)}…` : node.label}</text>}</g>)}</svg><small>Choose a node to inspect its dataset connections · {points.length} nodes shown</small></div><aside className="cosmic-graph-detail"><Kicker>{selected ? selected.kind : "About this map"}</Kicker><h3>{selected?.label || "A sphere of shared ideas"}</h3><p>{selected ? `Appears in ${selected.count.toLocaleString()} dataset records.` : `${graph.nodes.length.toLocaleString()} concepts and ${graph.edges.length.toLocaleString()} co-occurrence links were prepared from the supplied collections.`}</p>{selected && <><small>Connected concepts</small><ul>{related.map((node) => <li key={node.id}><button onClick={() => setSelectedId(node.id)}>{node.label}</button></li>)}</ul></>}<p className="cosmic-data-note">A visual index of text co-occurrence only; not a scientific model or a claim about heavenly influence.</p></aside></div>}
    </section>
  </CosmicSubPage>;
}

function Companion({ setPage, profile }: { setPage: (p: Page) => void; profile: UserProfile }) {
  const [messages, setMessages] = useState<{ id: string; from: "ai" | "user"; text: string }[]>([
    {
      id: "welcome",
      from: "ai",
      text: `Hi${profile.name ? ` ${profile.name}` : ""}. I’m here to help you think things through—not to judge or diagnose. Share what feels present, and I’ll respond directly and with care.`,
    },
  ]);
  const [text, setText] = useState("");
  const formatInline = (value: string) => value.split(/(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("==") && part.endsWith("==")) return <mark key={index}>{part.slice(2, -2)}</mark>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
  const renderCompanionText = (value: string) => {
    const blocks: { type: "paragraph" | "heading" | "ul" | "ol"; lines: string[] }[] = [];
    let current: { type: "paragraph" | "heading" | "ul" | "ol"; lines: string[] } | null = null;
    const push = () => { if (current?.lines.length) blocks.push(current); current = null; };
    for (const rawLine of value.replace(/\r/g, "").split("\n")) {
      const line = rawLine.trim();
      if (!line) { push(); continue; }
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const unordered = line.match(/^[-*•]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      const type = heading ? "heading" : unordered ? "ul" : ordered ? "ol" : "paragraph";
      const content = heading?.[1] ?? unordered?.[1] ?? ordered?.[1] ?? line;
      if (!current || current.type !== type || type === "heading") push();
      current ??= { type, lines: [] };
      current.lines.push(content);
    }
    push();
    return blocks.map((block, index) => {
      if (block.type === "heading") return <h4 key={index}>{formatInline(block.lines[0])}</h4>;
      if (block.type === "ul" || block.type === "ol") {
        const List = block.type === "ul" ? "ul" : "ol";
        return <List key={index}>{block.lines.map((line, lineIndex) => <li key={lineIndex}>{formatInline(line)}</li>)}</List>;
      }
      return <p key={index}>{formatInline(block.lines.join(" "))}</p>;
    });
  };
  const send = async (value = text) => {
    const message = value.trim();
    if (!message) return;
    const replyId = crypto.randomUUID();
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), from: "user", text: message },
      { id: replyId, from: "ai", text: "Let me think this through with care…" },
    ]);
    setText("");
    const literatureQuestion = /\b(book|novel|story|stories|character|plot|chapter|literature|fiction|poem|white nights|metamorphosis|dostoevsky|dostoyevsky|kafka|gregor samsa|nastenka|psycholog(?:y|ical)|perception|conditioning|psychometrics|intelligence|personality|heredity|developmental|social psychology|eysenck|textbook)\b/i.test(message)
      && !/\b(i feel|i'm feeling|i am feeling|my anxiety|my depression|my mood|i have anxiety|i have depression|help me cope|what should i do|i am struggling|i'm struggling)\b/i.test(message);
    const fallback = literatureQuestion
      ? "I couldn't retrieve a reliable passage from the literature memory for this question, so I won't invent an answer."
      : "I couldn't find a close match in my support memory, so I won't guess. For now, take one slow exhale, name the main pressure, and choose one small step you can finish in five minutes.";
    const reply = await getCompanionDatasetReply(message).catch(() => null);
    setMessages((items) => items.map((item) => item.id === replyId ? { ...item, text: reply || fallback } : item));
  };
  return (
    <div className="page companion-page">
      <PageHeader
        eyebrow="MANASIKA Companion"
        title="A thoughtful space to talk it through."
        text="This is a simulated prototype assistant. It cannot diagnose, provide therapy, or respond to emergencies."
        action={
          <Button variant="secondary" onClick={() => setPage("support")} icon="heart">
            Professional & crisis support
          </Button>
        }
      />
      <div className="chat-shell">
        <section className="chat-panel">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={m.id || i} className={`message ${m.from}`}>
                <span>{m.from === "ai" ? <Icon name="spark" /> : "A"}</span>
                {m.from === "ai" ? <div className="message-content">{renderCompanionText(m.text)}</div> : <p>{m.text}</p>}
              </div>
            ))}
          </div>
          <div className="quick-prompts">
            {[
              "I feel overwhelmed with college",
              "Help me organize my thoughts",
              "Suggest a calming exercise",
            ].map((q) => (
              <button key={q} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
          <label className="chat-input">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Write what’s on your mind..."
            />
            <button onClick={() => send()} aria-label="Send message">
              <Icon name="arrow" />
            </button>
          </label>
          <small className="chat-disclaimer">
            <Icon name="lock" /> Prototype conversation · Avoid sharing identifying or sensitive
            information
          </small>
        </section>
        <aside className="chat-side">
          <div className="ai-status">
            <span className="ai-orb">
              <Icon name="spark" />
            </span>
            <h3>Here with curiosity</h3>
            <p>Recommendations use only preferences you choose to share.</p>
          </div>
          <h3>Try asking about</h3>
          {[
            ["book", "A psychology concept"],
            ["journal", "A reflection prompt"],
            ["student", "A study-stress plan"],
            ["leaf", "A grounding exercise"],
          ].map((x) => (
            <button key={x[1]} onClick={() => send(`Help me with ${x[1].toLowerCase()}`)}>
              <Icon name={x[0] as IconName} />
              {x[1]}
              <Icon name="arrow" />
            </button>
          ))}
          <div className="safety-note">
            <Icon name="heart" />
            <p>
              <b>Need urgent support?</b>
              <br />
              MANASIKA is not an emergency service.
            </p>
            <button onClick={() => setPage("support")}>Find verified help</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Community({
  profile,
  posts,
  setPosts,
  joinedGroups,
  setJoinedGroups,
  onActivity,
}: {
  profile: UserProfile;
  posts: CommunityPost[];
  setPosts: React.Dispatch<React.SetStateAction<CommunityPost[]>>;
  joinedGroups: string[];
  setJoinedGroups: React.Dispatch<React.SetStateAction<string[]>>;
  onActivity: (action: string) => void;
}) {
  const [tab, setTab] = useState<"feed" | "groups">("feed");
  const [groupId, setGroupId] = useState(communityGroups[0].id);
  const [draft, setDraft] = useState("");
  const rankedGroups = [...communityGroups].sort((a, b) => {
    const score = (tags: string[]) => tags.filter((tag) => [...profile.likes, ...profile.supportGoals].includes(tag)).length;
    return score(b.tags) - score(a.tags);
  });
  const publish = () => {
    const text = draft.trim();
    if (!text) return;
    const group = communityGroups.find((item) => item.id === groupId)!;
    setPosts((items) => [{ id: crypto.randomUUID(), groupId, group: group.name, text, createdAt: new Date().toISOString() }, ...items].slice(0, 100));
    onActivity("Saved a community draft");
    setDraft("");
  };
  const toggleGroup = (id: string) => {
    const joined = joinedGroups.includes(id);
    setJoinedGroups((items) => joined ? items.filter((item) => item !== id) : [...items, id]);
    onActivity(joined ? "Left a group" : "Joined a group");
  };
  return (
    <div className="page community-page">
      <PageHeader eyebrow="Find your people" title="A little less alone." text="Explore supportive circles and share at your own pace." action={<span className="privacy-pill"><Icon name="heart" /> Kindness first</span>} />
      <div className="community-tabs">
        <Tag active={tab === "feed"} onClick={() => setTab("feed")}>Community posts</Tag>
        <Tag active={tab === "groups"} onClick={() => setTab("groups")}>Find groups</Tag>
      </div>
      <div className="community-notice"><Icon name="lock" /><p><b>Local preview</b> Posts and group choices are stored only in this browser. They are not sent to other people or shared across devices.</p></div>
      {tab === "feed" ? (
        <div className="community-layout">
          <section className="community-main">
            <div className="community-composer">
              <Kicker>Share a small thought</Kicker>
              <h2>You can be here without having it all figured out.</h2>
              <label className="field"><span>Choose a circle</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}>{communityGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <textarea maxLength={500} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Share a question, a small win, or something you are working through…" />
              <div className="community-compose-footer"><small>{draft.length}/500 · Keep identifying details private</small><Button onClick={publish} disabled={!draft.trim()}>Save post</Button></div>
            </div>
            <div className="community-feed-head"><div><Kicker>Recent reflections</Kicker><h2>Community board</h2></div><span>{posts.length} saved locally</span></div>
            {posts.length ? posts.map((post) => <article className="community-post" key={post.id}><div className="community-post-meta"><span className="avatar">{profile.name.trim().slice(0, 1).toUpperCase() || "M"}</span><div><b>{profile.name || "You"}</b><small>{post.group} · {new Date(post.createdAt).toLocaleDateString()}</small></div><button aria-label="Delete post" onClick={() => setPosts((items) => items.filter((item) => item.id !== post.id))}><Icon name="trash" /></button></div><p>{post.text}</p><small className="local-only-label">Saved in this browser only</small></article>) : <div className="community-empty"><span className="card-icon"><Icon name="users" /></span><h3>Your board is quiet for now.</h3><p>Write a first thought above. It will stay on this device until a real community service is connected.</p></div>}
          </section>
          <aside className="community-aside"><Kicker>Circles for you</Kicker><h2>Find a gentle fit</h2>{rankedGroups.slice(0, 3).map((group) => <article className="group-mini" key={group.id}><span className="card-icon"><Icon name={group.icon} /></span><b>{group.name}</b><p>{group.text}</p><button onClick={() => { setTab("groups"); setGroupId(group.id); }}>Explore circle <Icon name="arrow" /></button></article>)}</aside>
        </div>
      ) : (
        <section className="community-groups"><div className="community-feed-head"><div><Kicker>Based on what you chose</Kicker><h2>Find your circle</h2></div><span>{joinedGroups.length} joined</span></div><p className="community-intro">Suggestions use only the interests you selected. Your check-ins and journal are never used to match groups.</p><div className="group-grid">{rankedGroups.map((group) => { const joined = joinedGroups.includes(group.id); return <article className="group-card" key={group.id}><span className="card-icon"><Icon name={group.icon} /></span><h3>{group.name}</h3><p>{group.text}</p><div className="tag-wrap">{group.tags.map((tag) => <span className="group-tag" key={tag}>{tag}</span>)}</div><Button variant={joined ? "secondary" : "primary"} onClick={() => toggleGroup(group.id)}>{joined ? "Leave circle" : "Join circle"}</Button></article>; })}</div></section>
      )}
    </div>
  );
}

function Support() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="You deserve human support"
        title="Find Support"
        text="Clear steps for finding professional help and verified crisis resources in India."
      />
      <div className="emergency-banner">
        <Icon name="heart" size={30} />
        <div>
          <h2>If you or someone else is in immediate danger</h2>
          <p>
            Call India’s national emergency number <b>112</b> or go to the nearest hospital
            emergency department. MANASIKA is not an emergency response service.
          </p>
        </div>
        <a href="tel:112" className="btn btn-primary">
          Call 112
        </a>
      </div>
      <div className="support-grid">
        <article>
          <span>
            <Icon name="chat" />
          </span>
          <small>24/7 MENTAL HEALTH SUPPORT</small>
          <h2>Tele-MANAS</h2>
          <p>
            Government of India’s national tele-mental health service, offering counselling and
            connections to care.
          </p>
          <a href="tel:14416">
            Call 14416 <Icon name="arrow" />
          </a>
          <small>Also available: 1-800-891-4416</small>
        </article>
        <article>
          <span>
            <Icon name="heart" />
          </span>
          <small>SUICIDE & CRISIS SUPPORT</small>
          <h2>KIRAN</h2>
          <p>National mental health rehabilitation helpline from the Government of India.</p>
          <a href="tel:18005990019">
            Call 1800-599-0019 <Icon name="arrow" />
          </a>
          <small>Availability may vary; call 112 in immediate danger.</small>
        </article>
        <article>
          <span>
            <Icon name="student" />
          </span>
          <small>ON CAMPUS</small>
          <h2>Your college counsellor</h2>
          <p>
            Many campuses offer confidential counselling or student wellness services. Ask student
            affairs or your campus health centre.
          </p>
          <button>
            Plan what to say <Icon name="arrow" />
          </button>
        </article>
      </div>
      <section className="seeking-help">
        <div>
          <Kicker>Taking the first step</Kicker>
          <h2>What can I say when I ask for help?</h2>
          <p>You do not need the perfect words. You can begin simply:</p>
        </div>
        <blockquote>
          “I haven’t been feeling like myself, and it’s affecting my daily life. I’d like to speak
          with a mental health professional.”
        </blockquote>
        <div className="help-steps">
          {[
            "Check credentials and professional registration.",
            "Ask about confidentiality and fees.",
            "It is okay to try another professional if the fit is not right.",
          ].map((x, i) => (
            <p key={x}>
              <span>{i + 1}</span>
              {x}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Settings({ close, profile, setProfile, checkIns, activity, clearLocalData }: { close: () => void; profile: UserProfile; setProfile: React.Dispatch<React.SetStateAction<UserProfile>>; checkIns: MoodCheckIn[]; activity: ActivityItem[]; clearLocalData: () => void }) {
  const [tab, setTab] = useState("Preferences");
  return (
    <Modal title="Your preferences" close={close}>
      <div className="settings-tabs">
        {["Preferences", "Reminders", "Privacy & data"].map((t) => (
          <Tag key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </Tag>
        ))}
      </div>
      {tab === "Preferences" && (
        <div className="settings-body">
          <label className="field">
            <span>Preferred name</span>
            <input value={profile.name} onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))} placeholder="Your preferred name" />
          </label>
          <label className="field">
            <span>Language</span>
            <select defaultValue="English">
              <option>English</option>
              <option>Hindi</option>
              <option>Bengali</option>
            </select>
          </label>
          <label className="setting-row">
            <span>
              <b>Cosmic Corner</b>
              <small>Keep astrology separate from wellness recommendations</small>
            </span>
            <span className="switch">
              <input type="checkbox" defaultChecked />
              <i />
            </span>
          </label>
        </div>
      )}
      {tab === "Reminders" && (
        <div className="settings-body">
          <label className="setting-row">
            <span>
              <b>Daily check-in reminder</b>
              <small>A single gentle reminder at your chosen time</small>
            </span>
            <span className="switch">
              <input type="checkbox" defaultChecked />
              <i />
            </span>
          </label>
          <label className="field">
            <span>Reminder time</span>
            <input type="time" defaultValue="20:00" />
          </label>
          <p className="settings-note">We won’t repeatedly notify you if you don’t respond.</p>
        </div>
      )}
      {tab === "Privacy & data" && (
        <div className="settings-body">
          <div className="privacy-box">
            <Icon name="lock" />
            <p>
              <b>Your reflections and check-ins are private.</b>
              <br />
              This prototype stores profile, check-ins, reflections, posts, and activity on this device only. Community drafts are not shared or synced with other people.
            </p>
          </div>
          {profile.insightsEnabled && <section className="activity-log"><h3>Private activity log</h3><p>Section visits and saved check-ins from this browser. Message and journal contents are not included.</p>{activity.length ? <ul>{activity.slice(0, 20).map((item) => <li key={item.id}><span>{item.action} · {item.area}</span><small>{new Date(item.date).toLocaleString()}</small></li>)}</ul> : <small>No activity recorded yet.</small>}</section>}
          <Button
            variant="secondary"
            onClick={() => {
              const file = new Blob(
                [JSON.stringify({ profile, checkIns, activity, reflections: JSON.parse(localStorage.getItem("manasika.reflections.v1") || "[]"), posts: JSON.parse(localStorage.getItem("manasika.community.posts.v1") || "[]"), joinedGroups: JSON.parse(localStorage.getItem("manasika.community.groups.v1") || "[]") }, null, 2)],
                { type: "application/json" },
              );
              const link = document.createElement("a");
              link.href = URL.createObjectURL(file);
              link.download = "manasika-data.json";
              link.click();
              URL.revokeObjectURL(link.href);
            }}
          >
            Export my data
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              window.confirm("Delete all Manasika data saved in this browser? This cannot be undone.") && clearLocalData()
            }
          >
            Delete all local data
          </Button>
        </div>
      )}
      <div className="modal-actions">
        <Button onClick={close}>Save preferences</Button>
      </div>
    </Modal>
  );
}

export default function App() {
  const [page, setPageState] = useState<Page>("home");
  const currentTime = useCurrentTime();
  const [profile, setProfile] = useSavedState<UserProfile>("manasika.profile.v1", defaultProfile);
  const [checkIns, setCheckIns] = useSavedState<MoodCheckIn[]>("manasika.checkins.v1", []);
  const [posts, setPosts] = useSavedState<CommunityPost[]>("manasika.community.posts.v1", []);
  const [joinedGroups, setJoinedGroups] = useSavedState<string[]>("manasika.community.groups.v1", []);
  const [activity, setActivity] = useSavedState<ActivityItem[]>("manasika.activity.v1", []);
  const [mood, setMood] = useState<number | null>(() => checkIns.find((item) => item.date === todayKey())?.mood ?? null);
  const activeDay = localDateKey(currentTime);
  useEffect(() => {
    setMood(checkIns.find((item) => item.date === activeDay)?.mood ?? null);
  }, [activeDay, checkIns]);
  const [settings, setSettings] = useState(false);
  const logActivity = (action: string, area: string) => recordActivity(setActivity, action, area);
  const saveCheckIn = (entry: Omit<MoodCheckIn, "id" | "date">) => {
    const date = todayKey();
    setCheckIns((items) => {
      const next = items.filter((item) => item.date !== date);
      return [...next, { ...entry, id: date, date }].sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
    });
    setMood(entry.mood);
    logActivity("Saved a mood check-in", "Mood Journey");
  };
  const setPage = (p: Page) => {
    setPageState(p);
    if (p !== page) logActivity("Opened a section", p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finishOnboarding = (nextProfile: UserProfile) => {
    setProfile(nextProfile);
    logActivity("Completed preferences", "Onboarding");
    setPage("dashboard");
  };
  let content: React.ReactNode;
    switch (page) {
      case "dashboard":
        content = <Dashboard setPage={setPage} mood={mood} setMood={(nextMood) => saveCheckIn({ mood: nextMood, tags: [], note: "" })} profile={profile} checkIns={checkIns} />;
        break;
      case "discover":
        content = <Discover setPage={setPage} />;
        break;
      case "reflection":
        content = <Reflection onActivity={() => logActivity("Saved a reflection", "Reflection")} checkIns={checkIns} setPage={setPage} />;
        break;
      case "mood":
        content = <MoodJourney mood={mood} setMood={setMood} checkIns={checkIns} onSave={saveCheckIn} />;
        break;
      case "scenario":
        content = <Scenario />;
        break;
      case "peace":
        content = <Peace />;
        break;
      case "student":
        content = <StudentLife setPage={setPage} />;
        break;
      case "growth":
        content = <Growth checkIns={checkIns} activity={activity} />;
        break;
      case "creative":
        content = <Creative />;
        break;
      case "cosmic":
        content = <Cosmic setPage={setPage} />;
        break;
      case "zodiac-atlas":
        content = <ZodiacAtlas setPage={setPage} />;
        break;
      case "tarot":
        content = <TarotZone setPage={setPage} />;
        break;
      case "astro-graph":
        content = <AstrologyGraph setPage={setPage} />;
        break;
      case "companion":
        content = <Companion setPage={setPage} profile={profile} />;
        break;
      case "support":
        content = <Support />;
        break;
      case "community":
        content = <Community profile={profile} posts={posts} setPosts={setPosts} joinedGroups={joinedGroups} setJoinedGroups={setJoinedGroups} onActivity={(action) => logActivity(action, "Community")} />;
        break;
      default:
        content = null;
    }
  if (page === "home") return <Landing setPage={setPage} />;
  if (page === "onboarding") return <Onboarding finish={finishOnboarding} />;
  return (
    <>
      <AppShell page={page} setPage={setPage} openSettings={() => setSettings(true)} profile={profile}>
        {content}
      </AppShell>
      {settings && <Settings close={() => setSettings(false)} profile={profile} setProfile={setProfile} checkIns={checkIns} activity={activity} clearLocalData={() => { Object.keys(localStorage).filter((key) => key.startsWith("manasika.")).forEach((key) => localStorage.removeItem(key)); setCheckIns([]); setPosts([]); setJoinedGroups([]); setActivity([]); setProfile(defaultProfile); setMood(null); }} />}
    </>
  );
}
