import { useEffect, useState } from "react";
import manasikaLogo from "./assets/manasika-logo.webp";

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
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

const calendarMoods: Record<number, number> = {
  2: 1,
  4: 2,
  5: 1,
  7: 3,
  8: 2,
  11: 0,
  12: 1,
  14: 4,
  15: 3,
  18: 2,
  19: 1,
  20: 1,
  22: 2,
  24: 0,
  26: 1,
};

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
              className={page === item.id ? "active" : ""}
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
            className={page === item.id ? "active" : ""}
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
}: {
  setPage: (p: Page) => void;
  mood: number | null;
  setMood: (n: number) => void;
  profile: UserProfile;
}) {
  const [saved, setSaved] = useState(false);
  const lowMood = mood !== null && mood >= 3;
  const kindChoice = profile.likes.includes("Art") ? "creative" : profile.likes.includes("Writing") ? "reflective" : "gentle";
  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
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
            <div className="zodiac">♎</div>
            <h3>Make room for your own voice.</h3>
            <p>Your ideas deserve to be heard—even before they feel perfect.</p>
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
              <h3>4 small moments this week</h3>
            </div>
            <div className="week-dots">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className={i < 4 ? "filled" : ""}>
                  {d}
                </span>
              ))}
            </div>
            <p>You took time to understand yourself. That matters.</p>
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
      t.title.toLowerCase().includes(search.toLowerCase()),
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

function Reflection({ onActivity }: { onActivity: () => void }) {
  const [entry, setEntry] = useState("");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [savedEntries, setSavedEntries] = useSavedState<{id:number;date:string;title:string;text:string}[]>("manasika.reflections.v1", []);
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (!entry.trim()) return;
    setSavedEntries([
      { id: Date.now(), date: "Today, 8:42 PM", title: "Today’s reflection", text: entry },
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
              <h2>What are you carrying today that you don’t need to carry alone?</h2>
            </div>
            <button onClick={() => setEntry("What made me smile today?\\n\\n")}>New prompt</button>
          </div>
          <label className="journal-editor">
            <span>September 24 · Tuesday</span>
            <input placeholder="Give this moment a title..." />
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
              <h3>September 2025</h3>
              <button>View all</button>
            </div>
            <div className="calendar-mini-grid">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <b key={i}>{d}</b>
              ))}
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  className={
                    calendarMoods[i + 1] !== undefined ? `dot-tone-${calendarMoods[i + 1]}` : ""
                  }
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="previous-entries">
            <div>
              <h3>Previous entries</h3>
              <span>{savedEntries.length} entries</span>
            </div>
            {savedEntries.map((e) => (
              <article key={e.id}>
                <small>{e.date}</small>
                <h4>{e.title}</h4>
                <p>{e.text}</p>
                <div>
                  <button onClick={() => setEntry(e.text)}>
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
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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
                {monthOffset === 0
                  ? "September 2025"
                  : monthOffset < 0
                    ? "August 2025"
                    : "October 2025"}
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
            {Array.from({ length: 35 }, (_, i) =>
              i < 2 ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  className={selectedDay === i - 1 ? "selected-day" : ""}
                  onClick={() => setSelectedDay(i - 1)}
                >
                  <i>{i - 1}</i>
                  {calendarMoods[i - 1] !== undefined && (
                    <em>{moods[calendarMoods[i - 1]].emoji}</em>
                  )}
                </button>
              ),
            )}
          </div>
          {selectedDay && (
            <div className="day-detail">
              <span>
                {calendarMoods[selectedDay] !== undefined
                  ? moods[calendarMoods[selectedDay]].emoji
                  : "—"}
              </span>
              <div>
                <b>September {selectedDay}</b>
                <small>
                  {calendarMoods[selectedDay] !== undefined
                    ? "Your saved check-in"
                    : "No check-in saved"}
                </small>
              </div>
              {calendarMoods[selectedDay] !== undefined && (
                <>
                  <button>
                    <Icon name="edit" /> Edit
                  </button>
                  <button>
                    <Icon name="trash" /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <aside className="pattern-card">
          <small>GENTLE PATTERNS</small>
          <h2>Your recent week</h2>
          <div className="timeline-chart">
            {[40, 60, 52, 35, 72, 78, 65].map((h, i) => (
              <span key={i}>
                <i style={{ height: `${h}%` }} />
                <small>{["M", "T", "W", "T", "F", "S", "S"][i]}</small>
              </span>
            ))}
          </div>
          <h3>Peaceful appeared most often</h3>
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
  const [soundOn, setSoundOn] = useState(false);
  const [phase, setPhase] = useState("Breathe in");
  const [groundStep, setGroundStep] = useState(0);
  useEffect(() => {
    if (!running) return;
    const phases = ["Breathe in", "Hold gently", "Breathe out", "Rest"];
    const id = window.setInterval(
      () => setPhase((p) => phases[(phases.indexOf(p) + 1) % phases.length]),
      4000,
    );
    return () => clearInterval(id);
  }, [running]);
  return (
    <div className="page peace-page">
      <PageHeader
        eyebrow="A pause belongs here"
        title="Peace Corner"
        text="Nothing to achieve. Choose a small practice and let this moment be enough."
        action={
          <button className="sound-control" onClick={() => setSoundOn(!soundOn)}>
            <Icon name="play" /> Sound {soundOn ? "on" : "off"}
          </button>
        }
      />
      <div className="peace-tabs">
        <Tag active={exercise === "breathing"} onClick={() => setExercise("breathing")}>
          Guided breathing
        </Tag>
        <Tag active={exercise === "grounding"} onClick={() => setExercise("grounding")}>
          5–4–3–2–1 grounding
        </Tag>
        <Tag active={exercise === "mindfulness"} onClick={() => setExercise("mindfulness")}>
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
                <small>4 seconds</small>
              </span>
            </div>
            <div className="practice-copy">
              <Kicker>3 minute reset</Kicker>
              <h2>Come back to your breath.</h2>
              <p>
                Let the circle guide you. There’s no need to force a deep breath—just follow what
                feels comfortable.
              </p>
              <div className="duration-row">
                <span>Duration</span>
                {["1 min", "3 min", "5 min"].map((d, i) => (
                  <Tag key={d} active={i === 1}>
                    {d}
                  </Tag>
                ))}
              </div>
              <Button onClick={() => setRunning(!running)} icon={running ? undefined : "play"}>
                {running ? "Pause practice" : "Begin breathing"}
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
              onClick={() =>
                window.alert(`${x[1]} is ready. Audio will remain off until you play it.`)
              }
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

function StudentLife() {
  const [tab, setTab] = useState("Academic balance");
  const [tasks, setTasks] = useState([
    { text: "Review research notes", done: true },
    { text: "Draft two interview answers", done: false },
    { text: "Take a real lunch break", done: false },
  ]);
  const [newTask, setNewTask] = useState("");
  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { text: newTask, done: false }]);
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
              <h2>Tuesday, one thing at a time</h2>
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
                  onChange={() =>
                    setTasks(tasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))
                  }
                />
                <span>
                  <Icon name="check" />
                </span>
                <b>{t.text}</b>
                <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>
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
              ["spark", "Untangle a big worry", "5 min exercise"],
              ["journal", "Write a calmer plan", "Reflection prompt"],
              ["heart", "Confidence before comparison", "4 min read"],
            ].map((x) => (
              <button key={x[1]}>
                <Icon name={x[0] as IconName} />
                <span>
                  <b>{x[1]}</b>
                  <small>{x[2]}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
          <Button onClick={() => alert("Personal goal saved for this week.")} icon="plus">
            Set a personal goal
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Growth() {
  const [goalOpen, setGoalOpen] = useState(false);
  const [goals, setGoals] = useState(["Pause before saying yes", "End study by 10:30 PM"]);
  const [newGoal, setNewGoal] = useState("");
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
          <h2>You took time to understand yourself.</h2>
          <p>
            That matters. You showed up in four small ways this week—through a reflection, a
            check-in, learning, and rest.
          </p>
        </div>
        <div className="growth-ring">
          <span>
            <b>4</b>
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
          ["journal", "12", "Reflections written"],
          ["book", "7", "Topics explored"],
          ["mood", "18", "Mood check-ins"],
          ["spark", "3", "Boundaries practised"],
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
            {goals.map((g, i) => (
              <article key={g}>
                <button>
                  <Icon name="check" />
                </button>
                <div>
                  <h3>{g}</h3>
                  <p>{i === 0 ? "Practised 2 times this week" : "3 evenings felt more spacious"}</p>
                  <span>
                    <i style={{ width: i === 0 ? "55%" : "72%" }} />
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
            <article>
              <span>
                <Icon name="leaf" />
              </span>
              <div>
                <small>SEPTEMBER 22</small>
                <h3>You chose rest before burnout.</h3>
                <p>Completed a breathing practice during exam prep.</p>
              </div>
            </article>
            <article>
              <span>
                <Icon name="heart" />
              </span>
              <div>
                <small>SEPTEMBER 18</small>
                <h3>You listened to your own answer.</h3>
                <p>Reflected on a boundary before responding.</p>
              </div>
            </article>
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
                if (newGoal.trim()) setGoals([...goals, newGoal]);
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
  const [saved, setSaved] = useState(false);
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
          <button className={tab === t ? "active" : ""} onClick={() => setTab(t)} key={t}>
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
      {tab === "My Art" && (
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
                <input type="file" accept="image/*" />
                <Icon name="plus" /> Upload artwork
              </label>
              <Button onClick={() => setSaved(true)}>Save to gallery</Button>
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
            <h2>If today had a colour and shape, what would it be?</h2>
            <p>
              It can be messy, unfinished, abstract, or quiet. It only needs to feel like yours.
            </p>
            <Button
              variant="secondary"
              onClick={() => window.alert("A new private creative prompt is ready.")}
            >
              New prompt
            </Button>
          </aside>
        </div>
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
              <input type="file" accept="audio/*" />
              <Icon name="plus" /> Upload original audio
            </label>
          </section>
          <aside className="creative-prompt">
            <Kicker>Lyrics & ideas</Kicker>
            <textarea placeholder="A line, a rhythm, a feeling..." />
            <Button
              variant="secondary"
              onClick={() => window.alert("Your music note was saved privately.")}
            >
              Save note
            </Button>
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
              <Button onClick={() => setSaved(true)} disabled={!story.trim()}>
                {saved ? "Saved privately" : "Save story"}
              </Button>
            </div>
          </section>
          <aside className="creative-prompt">
            <Icon name="journal" />
            <small>WRITING PROMPT</small>
            <h2>Write about the version of you who kept going.</h2>
            <p>Fiction, memory, fragments—any form is welcome.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Cosmic() {
  const [sign, setSign] = useState("Libra");
  const signs = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  return (
    <div className="page cosmic-page">
      <div className="cosmic-sky">
        <span className="cosmic-stars">· ✦　˚　✧　·　✦　˚　✧　·</span>
        <Kicker>Cosmic Corner</Kicker>
        <h1>A little wonder for your day.</h1>
        <p>
          Positive astrology-inspired reflection, offered for entertainment—not as psychology,
          prediction, or life advice.
        </p>
        <div className="cosmic-message">
          <span>♎</span>
          <div>
            <small>TODAY’S MESSAGE FOR {sign.toUpperCase()}</small>
            <h2>Your voice and your pace both deserve respect.</h2>
            <p>
              Today is a lovely day to notice how far you’ve come without rushing what comes next.
            </p>
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
            <select value={sign} onChange={(e) => setSign(e.target.value)}>
              {signs.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
            {sign === "Libra" ? "♎" : sign === "Leo" ? "♌" : sign === "Cancer" ? "♋" : "✦"}
          </span>
          <small>{sign.toUpperCase()} · AIR</small>
          <h2>Harmony, creativity & thoughtful connection</h2>
          <p>
            Traditionally, {sign} is associated with an appreciation for balance, beauty, and seeing
            more than one perspective.
          </p>
          <div>
            <Tag>Diplomatic</Tag>
            <Tag>Creative</Tag>
            <Tag>Compassionate</Tag>
          </div>
        </div>
      </section>
      <section className="affirmation-card">
        <span>☾</span>
        <div>
          <small>COSMIC AFFIRMATION</small>
          <h2>“I am growing at my own pace, and my individuality is my strength.”</h2>
          <Button
            variant="secondary"
            onClick={() => window.alert("Affirmation saved to your private collection.")}
          >
            Save affirmation
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
          <Button
            variant="ghost"
            onClick={() =>
              window.alert(
                "Compatibility explorer opened. Readings focus only on playful communication styles.",
              )
            }
          >
            Choose two signs
          </Button>
        </article>
        <article>
          <Icon name="spark" />
          <h3>Birthday constellation</h3>
          <p>A positive greeting, affirmation, and reflection for your next year.</p>
          <Button
            variant="ghost"
            onClick={() =>
              window.alert(
                `Happy birthday, ${sign}! May the year ahead make room for curiosity, rest, and your own pace.`,
              )
            }
          >
            Preview celebration
          </Button>
        </article>
      </section>
    </div>
  );
}

function Companion({ setPage, profile, latestMood }: { setPage: (p: Page) => void; profile: UserProfile; latestMood: number | null }) {
  const [messages, setMessages] = useState<{ from: "ai" | "user"; text: string }[]>([
    {
      from: "ai",
      text: `Hi${profile.name ? ` ${profile.name}` : ""}. I’m here to help you think things through—not to judge or diagnose. What feels most present today?`,
    },
  ]);
  const [text, setText] = useState("");
  const send = (value = text) => {
    if (!value.trim()) return;
    setMessages((m) => [
      ...m,
      { from: "user", text: value },
      {
        from: "ai",
        text: latestMood !== null && latestMood >= 3 ? "That sounds heavy. We can take this one small moment at a time. Would you prefer a grounding exercise or a gentle reflection prompt?" : "Thank you for sharing that. Would it help to explore a small next step, or would you rather pause with a calming exercise?",
      },
    ]);
    setText("");
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
              <div key={i} className={`message ${m.from}`}>
                <span>{m.from === "ai" ? <Icon name="spark" /> : "A"}</span>
                <p>{m.text}</p>
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
  const [profile, setProfile] = useSavedState<UserProfile>("manasika.profile.v1", defaultProfile);
  const [checkIns, setCheckIns] = useSavedState<MoodCheckIn[]>("manasika.checkins.v1", []);
  const [posts, setPosts] = useSavedState<CommunityPost[]>("manasika.community.posts.v1", []);
  const [joinedGroups, setJoinedGroups] = useSavedState<string[]>("manasika.community.groups.v1", []);
  const [activity, setActivity] = useSavedState<ActivityItem[]>("manasika.activity.v1", []);
  const [mood, setMood] = useState<number | null>(() => checkIns.find((item) => item.date === todayKey())?.mood ?? null);
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
        content = <Dashboard setPage={setPage} mood={mood} setMood={(nextMood) => saveCheckIn({ mood: nextMood, tags: [], note: "" })} profile={profile} />;
        break;
      case "discover":
        content = <Discover setPage={setPage} />;
        break;
      case "reflection":
        content = <Reflection onActivity={() => logActivity("Saved a reflection", "Reflection")} />;
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
        content = <StudentLife />;
        break;
      case "growth":
        content = <Growth />;
        break;
      case "creative":
        content = <Creative />;
        break;
      case "cosmic":
        content = <Cosmic />;
        break;
      case "companion":
        content = <Companion setPage={setPage} profile={profile} latestMood={mood} />;
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
      {settings && <Settings close={() => setSettings(false)} profile={profile} setProfile={setProfile} checkIns={checkIns} activity={activity} clearLocalData={() => { setCheckIns([]); setPosts([]); setJoinedGroups([]); setActivity([]); setProfile(defaultProfile); localStorage.removeItem("manasika.reflections.v1"); setMood(null); }} />}
    </>
  );
}
