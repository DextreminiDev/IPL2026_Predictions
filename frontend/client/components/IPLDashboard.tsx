import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

const RAW_DATA_MODULES = import.meta.glob("./data/*.json", { eager: true }) as Record<string, any>;

const LOADED_MATCHES: any[] = Object.entries(RAW_DATA_MODULES).map(([path, mod], idx) => {
    const data         = mod.default ?? mod;
    const scenarioKeys = Object.keys(data.scenarios ?? {});
    const team1Key     = scenarioKeys[0]?.replace("_batting_first", "") ?? "TBD";
    const team2Key     = scenarioKeys[1]?.replace("_batting_first", "") ?? "TBD";
    const sc0          = data.scenarios[scenarioKeys[0]];
    const wp           = sc0?.predictions?.win_probability;
    return {
        id:           path,
        match_number: idx + 1,
        date:         data.match_info?.date ?? "",
        time:         data.match_info?.time ?? "",
        team1:        team1Key,
        team2:        team2Key,
        venue:        data.match_info?.venue ?? "",
        status:       "predicted" as const,
        team1_wp:     wp?.team_1 ?? null,
        team2_wp:     wp?.team_2 ?? null,
        _raw:         data,
    };
});


// ─────────────────────────────────────────────────────────────────────────────
// TEAM CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TEAM_CONFIG: Record<string, { name: string; short: string; color: string; accent: string; bg: string }> = {
    RCB:  { name: "Royal Challengers Bengaluru", short: "RCB",  color: "#EC1C24", accent: "#FFD700", bg: "rgba(236,28,36,0.15)"   },
    SRH:  { name: "Sunrisers Hyderabad",         short: "SRH",  color: "#FF822A", accent: "#000000", bg: "rgba(255,130,42,0.15)"  },
    MI:   { name: "Mumbai Indians",              short: "MI",   color: "#004BA0", accent: "#D4AF37", bg: "rgba(0,75,160,0.15)"    },
    CSK:  { name: "Chennai Super Kings",         short: "CSK",  color: "#FFCB05", accent: "#0081C9", bg: "rgba(255,203,5,0.15)"   },
    KKR:  { name: "Kolkata Knight Riders",       short: "KKR",  color: "#3A225D", accent: "#D4AF37", bg: "rgba(58,34,93,0.15)"    },
    DC:   { name: "Delhi Capitals",              short: "DC",   color: "#0078BC", accent: "#EF1C25", bg: "rgba(0,120,188,0.15)"   },
    GT:   { name: "Gujarat Titans",              short: "GT",   color: "#A0A0A0", accent: "#C8A84B", bg: "rgba(160,160,160,0.15)" },
    RR:   { name: "Rajasthan Royals",            short: "RR",   color: "#EA1A85", accent: "#254AA5", bg: "rgba(234,26,133,0.15)"  },
    PBKS: { name: "Punjab Kings",                short: "PBKS", color: "#ED1F27", accent: "#A7A9AC", bg: "rgba(237,31,39,0.15)"   },
    LSG:  { name: "Lucknow Super Giants",        short: "LSG",  color: "#A72B55", accent: "#00BFFF", bg: "rgba(167,43,85,0.15)"   },
};

function getTeam(key: string) {
    return TEAM_CONFIG[key] ?? {
        name: key, short: key.slice(0, 3).toUpperCase(),
        color: "#888", accent: "#fff", bg: "rgba(136,136,136,0.15)",
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// VENUE HISTORY TEAM NAME RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function buildTeamIdLookup(matchData: any): Record<string, string> {
    const lookup: Record<string, string> = {};
    const scenarioKeys = Object.keys(matchData.scenarios ?? {});

    scenarioKeys.forEach(sKey => {
        const sc        = matchData.scenarios[sKey];
        const shortCode = sKey.replace("_batting_first", "");
        const teamId    = sc?.predictions?.team_id ?? sc?.team_id;
        if (teamId != null) {
            lookup[String(teamId)] = shortCode;
        }
    });

    return lookup;
}

function resolveTeamName(
    teamRef:   any,
    team1Key:  string,
    team2Key:  string,
    idLookup?: Record<string, string>,
): string {
    if (!teamRef && teamRef !== 0) return "?";
    const s = String(teamRef).toLowerCase().trim();

    if (s === "team_1" || s === "1") return getTeam(team1Key).short;
    if (s === "team_2" || s === "2") return getTeam(team2Key).short;
    if (TEAM_CONFIG[teamRef])        return String(teamRef);
    if (idLookup?.[String(teamRef)]) return idLookup[String(teamRef)];

    return String(teamRef);
}


// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function cleanVenueName(venue: string) {
    if (!venue) return "";
    return venue.split(",")[0].trim();
}

function TeamLogo({ team, size = 32, className = "", style = {} }: { team: any, size?: number, className?: string, style?: React.CSSProperties }) {
    const [imgSrc, setImgSrc] = useState(`/logos/${team.short}.png`);
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div className={className} style={{ width: size, height: size, borderRadius: "50%", background: team.bg, border: `1px solid ${team.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: Math.max(10, size * 0.4), color: team.color, flexShrink: 0, ...style }}>
                {team.short[0]}
            </div>
        );
    }

    return (
        <img
            src={imgSrc}
            alt={team.short}
            className={className}
            style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...style }}
            onError={() => {
                if (imgSrc.endsWith(".png")) {
                    setImgSrc(`/logos/${team.short}.jpg`);
                } else {
                    setFailed(true);
                }
            }}
        />
    );
}

const ciRiskColor: Record<string, string> = {
    low: "#22c55e", medium: "#f59e0b", high: "#ef4444",
};
const ciRiskLabel: Record<string, string> = {
    low: "Confident", medium: "Moderate Variance", high: "High Uncertainty",
};

function useCountUp(target: number, duration = 900) {
    const [val, setVal] = useState(0);
    const prev          = useRef(0);
    const raf           = useRef<number>(0);

    useEffect(() => {
        const start     = prev.current;
        const diff      = target - start;
        const startTime = Date.now();
        const tick = () => {
            const elapsed = Date.now() - startTime;
            const t       = Math.min(elapsed / duration, 1);
            const ease    = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            setVal(Math.round(start + diff * ease));
            if (t < 1) { raf.current = requestAnimationFrame(tick); }
            else { setVal(target); prev.current = target; }
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [target, duration]);

    return val;
}


// ─────────────────────────────────────────────────────────────────────────────
// SCORE CURVE CHART
// ─────────────────────────────────────────────────────────────────────────────

function ScoreCurveChart({
    battingData, chasingData, battingColor, chasingColor, height = 160,
}: {
    battingData: any[]; chasingData?: any[];
    battingColor: string; chasingColor?: string; height?: number;
}) {
    if (!battingData?.length) return null;

    const allC        = [...battingData.map((d: any) => d.cumulative), ...(chasingData ?? []).map((d: any) => d.cumulative)];
    const maxC        = Math.max(...allC);
    const roundedMaxC = Math.ceil(maxC / 25) * 25;

    const W      = 400;
    const H      = height;
    const PAD_L  = 36;
    const PAD_B  = 22;
    const chartW = W - PAD_L;
    const chartH = H - PAD_B;

    const toX = (i: number, total: number) => PAD_L + (i / Math.max(total - 1, 1)) * chartW;
    const toY = (v: number)                => chartH - (v / roundedMaxC) * chartH;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(t * roundedMaxC));
    const n      = battingData.length;

    const ppEnd  = 5;   // index of over 6 (last PP over)
    const midEnd = 15;  // index of over 16 (last MID over)

    const pts = (data: any[]) =>
        data.map((d: any, i: number) => `${toX(i, data.length)},${toY(d.cumulative)}`).join(" ");

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", overflow: "visible", minHeight: 120 }}>

            {/* Y gridlines + labels */}
            {yTicks.map((val, i) => {
                const y = toY(val);
                return (
                    <g key={i}>
                        <line x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y}
                            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        <text x={PAD_L - 5} y={y + 3.5} textAnchor="end"
                            fill="#444" fontSize="7" fontFamily="monospace">{val}</text>
                    </g>
                );
            })}

            {/* X baseline */}
            <line x1={PAD_L} y1={chartH} x2={PAD_L + chartW} y2={chartH}
                stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* Phase backgrounds */}
            <rect x={PAD_L}                          y={0} width={(6/20)*chartW}  height={chartH} fill="rgba(34,197,94,0.05)" />
            <rect x={PAD_L + (6/20)*chartW}          y={0} width={(9/20)*chartW}  height={chartH} fill="rgba(99,102,241,0.05)" />
            <rect x={PAD_L + (15/20)*chartW}         y={0} width={(5/20)*chartW}  height={chartH} fill="rgba(239,68,68,0.05)" />

            {/* Phase dividers */}
            <line x1={toX(ppEnd,  n)} y1={0} x2={toX(ppEnd,  n)} y2={chartH}
                stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.6" />
            <line x1={toX(midEnd, n)} y1={0} x2={toX(midEnd, n)} y2={chartH}
                stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.6" />

            {/* X labels */}
            {battingData.map((item, idx) => {
                const over = item.over ?? (idx + 1);
                return (
                    <text key={idx} x={toX(idx, n)} y={chartH + 13}
                        textAnchor="middle" fill="#444" fontSize="7" fontFamily="monospace">
                        {over}
                    </text>
                );
            })}

            {/* Chasing line */}
            {chasingData && chasingData.length > 1 && (
                <polyline points={pts(chasingData)} fill="none"
                    stroke={chasingColor ?? "#6366f1"} strokeWidth="1.4"
                    strokeLinejoin="round" opacity="0.7" />
            )}

            {/* Batting line */}
            {battingData.length > 1 && (
                <polyline points={pts(battingData)} fill="none"
                    stroke={battingColor} strokeWidth="1.8"
                    strokeLinejoin="round" opacity="0.95" />
            )}
        </svg>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// CI BAR
// ─────────────────────────────────────────────────────────────────────────────

function CIBar({ pred, displayScore, teamColor, outsideCI }: {
    pred: any; displayScore: number; teamColor: string; outsideCI: boolean;
}) {
    const lo = pred.ci_low ?? 0;
    const hi = pred.ci_high ?? 1;

    const displayLo    = Math.floor(lo / 50) * 50;
    const displayHi    = Math.ceil(hi / 50) * 50;
    const displayRange = Math.max(displayHi - displayLo, 50);

    const rawPct = ((displayScore - displayLo) / displayRange) * 100;
    const dotPct = Math.min(98, Math.max(2, rawPct));

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#555" }}>80% Confidence Interval</span>
                <span style={{ color: ciRiskColor[pred.ci_risk ?? "low"], fontWeight: 600, fontSize: 10 }}>
                    ● {ciRiskLabel[pred.ci_risk ?? "low"]}
                </span>
            </div>

            <div style={{ position: "relative", height: 6,
                background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 4 }}>

                <div style={{
                    position: "absolute",
                    left: `${((lo - displayLo) / displayRange) * 100}%`,
                    right: `${((displayHi - hi) / displayRange) * 100}%`,
                    height: "100%",
                    background: ciRiskColor[pred.ci_risk ?? "low"],
                    borderRadius: 3,
                    opacity: 0.5,
                }} />

                <div style={{
                    position:       "absolute",
                    left:           `${dotPct}%`,
                    top:          -3,
                    width:        12,
                    height:       12,
                    borderRadius: "50%",
                    background:   outsideCI ? "#60a5fa" : teamColor,
                    transform:    "translateX(-50%)",
                    outline:      outsideCI ? "2px solid rgba(96,165,250,0.7)" : "none",
                    outlineOffset: "1px",
                    zIndex:       2,
                }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444" }}>
                <span>{displayLo}</span>
                <span style={{ color: teamColor + "cc", fontWeight: 600 }}>{lo}–{hi}</span>
                <span>{displayHi}</span>
            </div>

            {outsideCI && (
                <div style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#bfdbfe",
                    background: "rgba(37,99,235,0.25)",
                    padding: "7px 10px",
                    borderRadius: 8,
                    lineHeight: 1.5,
                    border: "1px solid rgba(96,165,250,0.45)",
                    boxShadow: "0 0 8px rgba(96,165,250,0.15)",
                }}>
                    🌧 D/L target falls outside the model's original CI — the rain adjustment has shifted the expected score beyond the pre-rain range.
                </div>
            )}
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// INNINGS FORECAST CARD
// ─────────────────────────────────────────────────────────────────────────────

function InningsForecastCard({ label, pred, teamColor, teamName, isFirstInnings, rainMode, rainScore }: {
    label: string; pred: any; teamColor: string; teamName: string;
    isFirstInnings: boolean; rainMode?: boolean; rainScore?: number | null;
}) {
    const normalScore        = isFirstInnings
        ? (pred.point as number)
        : (("runs_point" in pred ? pred.runs_point : pred.point) as number);

    const hasRainAdjustment  = !!(rainMode && rainScore != null);
    const displayScore       = hasRainAdjustment ? (rainScore as number) : normalScore;
    const animScore          = useCountUp(displayScore);

    const firstInningsWkts   = Math.min(10, Math.max(1, Math.round(displayScore / 22)));
    const displayWickets     = isFirstInnings ? firstInningsWkts : (pred.wickets ?? firstInningsWkts);

    const outsideCI = hasRainAdjustment
        ? ((rainScore as number) < pred.ci_low || (rainScore as number) > pred.ci_high)
        : false;

    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${teamColor}20`,
            borderRadius: 16, padding: 20, position: "relative", overflow: "hidden",
            animation: "fadeSlideIn 0.35s ease both" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80,
                background: `radial-gradient(circle, ${teamColor}12, transparent 70%)` }} />

            {hasRainAdjustment && (
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10,
                    color: "#93c5fd", background: "rgba(37,99,235,0.3)",
                    padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(96,165,250,0.5)",
                    fontWeight: 600 }}>
                    🌧 D/L adjusted
                </div>
            )}

            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase",
                letterSpacing: "0.12em", fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: teamColor + "aa", marginBottom: 12 }}>{teamName}</div>

            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 42, fontWeight: 700,
                background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                lineHeight: 1, marginBottom: 4 }}>
                {animScore}
            </div>

            <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                {hasRainAdjustment
                    ? `${displayScore}/${displayWickets} (D/L projected)`
                    : `${displayScore}/${displayWickets} · ${isFirstInnings ? "Poisson wicket estimate" : `${displayWickets} wickets down`}`
                }
            </div>

            <CIBar pred={pred} displayScore={displayScore} teamColor={teamColor} outsideCI={outsideCI} />
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// MATCH DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────────

function MatchDetailPage({ matchData, team1Key, team2Key, onBack }: {
    matchData: any; team1Key: string; team2Key: string; onBack: () => void;
}) {
    const scenarioKeys = Object.keys(matchData.scenarios ?? {});
    const [scenario,  setScenario]  = useState(scenarioKeys[0]);
    const [rainMode,  setRainMode]  = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef        = useRef<HTMLDivElement>(null);
    const [headerStuck, setHeaderStuck] = useState(false);

    useEffect(() => {
        const container = scrollContainerRef.current;
        const sentinel  = sentinelRef.current;
        if (!container || !sentinel) return;
        const obs = new IntersectionObserver(
            ([entry]) => setHeaderStuck(!entry.isIntersecting),
            { root: container, threshold: 0 },
        );
        obs.observe(sentinel);
        return () => obs.disconnect();
    }, []);

    const t1 = getTeam(team1Key);
    const t2 = getTeam(team2Key);
    const sc = matchData.scenarios[scenario];

    const isBattingFirst = scenario === scenarioKeys[0];
    const batFirst       = isBattingFirst ? t1 : t2;
    const fieldFirst     = isBattingFirst ? t2 : t1;

    const wp       = rainMode && sc.rain_scenario
        ? { team_1: sc.rain_scenario.rain_team1_wp, team_2: 1 - sc.rain_scenario.rain_team1_wp }
        : sc.predictions.win_probability;
    const t1WP     = Math.round(wp.team_1 * 100);
    const t2WP     = Math.round(wp.team_2 * 100);
    const animT1WP = useCountUp(t1WP);
    const animT2WP = useCountUp(t2WP);

    const fi          = sc.predictions.first_innings;
    const si          = sc.predictions.second_innings;
    const rainFiScore = sc.rain_scenario?.rain_projected_score_i1 ?? null;
    const rainSiScore = sc.rain_scenario?.rain_projected_score_i2 ?? null;

    const curveRaw     = sc.score_curve ?? {};
    const battingCurve = Array.isArray(curveRaw) ? curveRaw               : (curveRaw.team_1_batting ?? []);
    const chasingCurve = Array.isArray(curveRaw) ? []                     : (curveRaw.team_2_chasing ?? []);

    const dangerRaw    = sc.danger_bowlers ?? {};
    const dangerT1Bowl = Array.isArray(dangerRaw) ? []        : (dangerRaw.team_1_bowling ?? []);
    const dangerT2Bowl = Array.isArray(dangerRaw) ? dangerRaw : (dangerRaw.team_2_bowling ?? []);

    const tossStats  = sc.toss_advantage_stats ?? sc.toss_stats ?? null;
    const t1ImpKey   = isBattingFirst ? "if_batting_first"  : "if_fielding_first";
    const t2ImpKey   = isBattingFirst ? "if_fielding_first" : "if_batting_first";

    const teamIdLookup = buildTeamIdLookup(matchData);

    const allInsights = sc.insights ?? [];
    const h2hInsights = allInsights.filter((ins: any) => ins.type === "H2H_ALERT");

    return (
        <div ref={scrollContainerRef} style={{ height: "100vh", overflowY: "auto",
            background: "#080c14", color: "#e8eaf0",
            fontFamily: "'DM Sans','Segoe UI',sans-serif", position: "relative" }}>
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .sticky-team-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                    flex: 1;
                    flex-wrap: nowrap;
                    overflow: hidden;
                }
                .sticky-team-name {
                    font-weight: 700;
                    font-size: 13px;
                    white-space: nowrap;
                }
                @media (max-width: 400px) {
                    .sticky-team-name { font-size: 11px !important; }
                    .sticky-venue { max-width: 80px !important; font-size: 9px !important; }
                }
                @media (max-width: 640px) {
                    .innings-grid { grid-template-columns: 1fr !important; }
                    .hero-avatar  { width: 52px !important; height: 52px !important; font-size: 18px !important; }
                    .hero-venue   { display: none !important; }
                    .tab-btn      { padding: 10px 8px !important; font-size: 11px !important; }
                }
                .score-curve-legend {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                    font-size: 9px;
                }
                .venue-row {
                    display: grid;
                    grid-template-columns: 64px 1fr auto auto;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 0;
                }
                .venue-teams { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; }
                .venue-team-name { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .venue-scores { display: flex; gap: 4px; font-size: 10px; font-family: monospace; white-space: nowrap; }
                .venue-winner { font-size: 10px; color: #22c55e; white-space: nowrap; }
            `}</style>

            {/* Ambient glows */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                <div style={{ position: "absolute", top: "-20%", left: "5%", width: 400, height: 400,
                    borderRadius: "50%", background: `radial-gradient(circle, ${t1.color}14 0%, transparent 70%)`, filter: "blur(60px)" }} />
                <div style={{ position: "absolute", top: "-10%", right: "5%", width: 320, height: 320,
                    borderRadius: "50%", background: `radial-gradient(circle, ${t2.color}14 0%, transparent 70%)`, filter: "blur(60px)" }} />
            </div>

            <div ref={sentinelRef} style={{ height: 1, width: "100%", flexShrink: 0 }} />

            {/* Sticky topbar */}
            <div style={{ position: "sticky", top: 0, zIndex: 100,
                background: headerStuck ? "rgba(8,12,20,0.97)" : "transparent",
                backdropFilter: headerStuck ? "blur(20px)" : "none",
                borderBottom: headerStuck ? "1px solid rgba(255,255,255,0.07)" : "none",
                transition: "background 0.25s", padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "none",
                    color: "#fff", padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, flexShrink: 0 }}>
                    ← Matches
                </button>

                {headerStuck && (
                    <div className="sticky-team-row">
                        <span className="sticky-team-name" style={{ color: t1.color }}>{t1.short}</span>
                        <span style={{ opacity: 0.35, fontSize: 10, flexShrink: 0 }}>vs</span>
                        <span className="sticky-team-name" style={{ color: t2.color }}>{t2.short}</span>
                        <span className="sticky-venue" style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px",
                            borderRadius: 6, fontSize: 10, opacity: 0.6,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            maxWidth: 120, flexShrink: 1 }}>
                            {cleanVenueName(matchData.match_info.venue)}
                        </span>
                    </div>
                )}

                <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <button onClick={() => setRainMode(r => !r)} style={{
                        background: rainMode ? "rgba(99,182,246,0.2)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${rainMode ? "#60a5fa" : "rgba(255,255,255,0.1)"}`,
                        color: rainMode ? "#60a5fa" : "#aaa", padding: "6px 10px",
                        borderRadius: 8, cursor: "pointer", fontSize: 11,
                        display: "flex", alignItems: "center", gap: 4 }}>
                        🌧 {rainMode ? "ON" : "OFF"}
                    </button>
                </div>
            </div>

            {/* Page body */}
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px 100px", position: "relative", zIndex: 1 }}>

                {/* Hero */}
                <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em",
                        textTransform: "uppercase", marginBottom: 6 }}>
                        {matchData.match_info.date} · {matchData.match_info.time} · IPL 2026
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 16, flexWrap: "wrap" }}>
                        {([t1, null, t2] as any[]).map((item, i) =>
                            item === null ? (
                                <div key="venue" className="hero-venue" style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em",
                                        textTransform: "uppercase", marginBottom: 3 }}>Venue</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", maxWidth: 120 }}>
                                        {cleanVenueName(matchData.match_info.venue)}
                                    </div>
                                </div>
                            ) : (
                                <div key={item.short} style={{ textAlign: "center" }}>
                                    <TeamLogo 
                                        team={item} 
                                        size={64} 
                                        className="hero-avatar"
                                        style={{ margin: "0 auto 6px", filter: `drop-shadow(0 0 10px ${item.color}40)` }} 
                                    />
                                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.short}</div>
                                    <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>
                                        {item.name.split(" ").slice(-1)[0]}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Scenario toggle */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12,
                        padding: 4, display: "flex", gap: 2, border: "1px solid rgba(255,255,255,0.08)" }}>
                        {scenarioKeys.map(key => {
                            const isFirst = key === scenarioKeys[0];
                            const col     = isFirst ? t1.color : t2.color;
                            const label   = isFirst ? `${t1.short} bats first` : `${t2.short} bats first`;
                            const active  = scenario === key;
                            return (
                                <button key={key} onClick={() => setScenario(key)} style={{
                                    padding: "6px 12px", borderRadius: 9, border: "none",
                                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                                    background: active ? `linear-gradient(135deg, ${col}30, ${col}15)` : "transparent",
                                    color: active ? col : "#666",
                                    outline: active ? `1px solid ${col}40` : "1px solid transparent",
                                    transition: "all 0.2s", whiteSpace: "nowrap" }}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Win Probability */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.07)", padding: "16px 16px",
                    marginBottom: 12, position: "relative", overflow: "hidden" }}>
                    {rainMode && sc.rain_scenario && (
                        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9,
                            color: "#60a5fa", background: "rgba(96,165,250,0.1)",
                            padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(96,165,250,0.2)" }}>
                            🌧 Rain active · favours {sc.rain_scenario.rain_favours?.replace("_", " ") ?? "neutral"}
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em",
                        textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Win Probability</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: t1.color,
                            minWidth: 44, fontFamily: "'Space Mono',monospace" }}>{animT1WP}%</span>
                        <div style={{ flex: 1, height: 12, borderRadius: 6, minWidth: 70,
                            background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ display: "flex", height: "100%" }}>
                                <div style={{ width: `${t1WP}%`, height: "100%",
                                    background: `linear-gradient(90deg, ${t1.color}, ${t1.color}cc)`,
                                    borderRadius: "6px 0 0 6px",
                                    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                                <div style={{ flex: 1, height: "100%",
                                    background: `linear-gradient(90deg, ${t2.color}cc, ${t2.color})`,
                                    borderRadius: "0 6px 6px 0" }} />
                            </div>
                        </div>
                        <span style={{ fontSize: 24, fontWeight: 800, color: t2.color,
                            minWidth: 44, textAlign: "right", fontFamily: "'Space Mono',monospace" }}>
                            {animT2WP}%
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, flexWrap: "wrap", gap: 2 }}>
                        <span style={{ fontSize: 10, color: t1.color + "99" }}>{t1.name}</span>
                        <span style={{ fontSize: 10, color: t2.color + "99" }}>{t2.name}</span>
                    </div>
                </div>

                {/* Tab bar */}
                <div style={{ display: "flex", gap: 0, marginBottom: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                    {([
                        ["overview",  "Overview",     "📊"],
                        ["matchups",  "H2H Matchups", "⚡"],
                        ["venue",     "Venue Intel",  "🏟"],
                        ["insights",  "Insights",     "💡"],
                    ] as [string,string,string][]).map(([key, lbl]) => (
                        <button key={key} className="tab-btn" onClick={() => setActiveTab(key)} style={{
                            padding: "10px 12px", border: "none", cursor: "pointer",
                            background: "transparent", fontSize: 12, fontWeight: 600,
                            color: activeTab === key ? "#fff" : "#555",
                            borderBottom: activeTab === key ? "2px solid #fff" : "2px solid transparent",
                            transition: "all 0.2s", marginBottom: -1, whiteSpace: "nowrap" }}>
                            {lbl}
                        </button>
                    ))}
                </div>


                {/* ── OVERVIEW ─────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div>
                        <div key={`${scenario}-${rainMode}`} className="innings-grid" style={{
                            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: 12, marginBottom: 12 }}>
                            <InningsForecastCard
                                label="1st Innings Forecast" pred={fi}
                                teamColor={batFirst.color} teamName={`${batFirst.short} batting`}
                                isFirstInnings={true} rainMode={rainMode} rainScore={rainFiScore} />
                            <InningsForecastCard
                                label="2nd Innings Forecast" pred={si}
                                teamColor={fieldFirst.color} teamName={`${fieldFirst.short} chasing`}
                                isFirstInnings={false} rainMode={rainMode} rainScore={rainSiScore} />
                        </div>

                        {battingCurve.length > 0 && (
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.07)", padding: 16, marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                            letterSpacing: "0.12em", fontWeight: 600 }}>Score Momentum Curve</div>
                                        <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                                            Projected cumulative runs · X = over, Y = runs
                                        </div>
                                    </div>
                                    <div className="score-curve-legend">
                                        <span style={{ color: batFirst.color }}>── {batFirst.short}</span>
                                        {chasingCurve.length > 0 && (
                                            <span style={{ color: fieldFirst.color, opacity: 0.6 }}>- - {fieldFirst.short}</span>
                                        )}
                                        <span style={{ color: "#22c55e" }}>■ PP</span>
                                        <span style={{ color: "#6366f1" }}>■ MID</span>
                                        <span style={{ color: "#ef4444" }}>■ DTH</span>
                                    </div>
                                </div>
                                <ScoreCurveChart
                                    battingData={battingCurve}
                                    chasingData={chasingCurve.length > 0 ? chasingCurve : undefined}
                                    battingColor={batFirst.color} chasingColor={fieldFirst.color} />
                            </div>
                        )}

                        {/* Impact Players */}
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                            border: "1px solid rgba(255,255,255,0.07)", padding: 16, marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                letterSpacing: "0.12em", fontWeight: 600, marginBottom: 12 }}>
                                AI Scout · Impact Player Recommendations
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                                {([
                                    { team: t1, ipData: sc.impact_player_recommendations?.team_1, sk: t1ImpKey },
                                    { team: t2, ipData: sc.impact_player_recommendations?.team_2, sk: t2ImpKey },
                                ] as { team: ReturnType<typeof getTeam>; ipData: any; sk: string }[]).map(({ team, ipData, sk }) => {
                                    const ip = ipData?.[sk];
                                    if (!ip) return null;
                                    const roleColor = ip.role === "bowler" ? "#f59e0b" : ip.role === "allrounder" ? "#a78bfa" : "#34d399";
                                    return (
                                        <div key={team.short} style={{ background: `${team.color}0a`,
                                            border: `1px solid ${team.color}25`, borderRadius: 12, padding: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                <TeamLogo team={team} size={26} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{ip.player_name}</div>
                                                    <div style={{ fontSize: 9, color: team.color + "aa" }}>{team.name}</div>
                                                </div>
                                                <div style={{ fontSize: 9, padding: "1px 6px",
                                                    borderRadius: 16, background: `${roleColor}20`, color: roleColor,
                                                    fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>
                                                    {ip.role}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 10, color: "#666", lineHeight: 1.4 }}>{ip.reason}</div>
                                            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontSize: 9, color: "#444" }}>Slot</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                    <div style={{ width: 40, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                                                        <div style={{ width: `${ip.slot_score * 100}%`, height: "100%", background: team.color }} />
                                                    </div>
                                                    <span style={{ fontSize: 9, color: team.color, fontFamily: "monospace" }}>
                                                        {(ip.slot_score * 100).toFixed(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Model Transparency */}
                        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.05)", padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase",
                                letterSpacing: "0.12em", fontWeight: 600, marginBottom: 10 }}>Model Transparency</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
                                {([
                                    { label: "Score MAE",   val: `±${sc.model_confidence?.m1_mae_val} runs`, hint: "Avg error" },
                                    { label: "Chase MAE",   val: `±${sc.model_confidence?.m2_mae_val}`,        hint: "Run diff" },
                                    { label: "Brier Score", val: sc.model_confidence?.m3_brier_val,            hint: "Perfect=0" },
                                    { label: "Log-Loss",    val: sc.model_confidence?.m3_logloss_val,          hint: "Calibration" },
                                ] as { label: string; val: any; hint: string }[]).map(({ label, val, hint }) => (
                                    <div key={label} style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc", fontFamily: "'Space Mono',monospace" }}>{val}</div>
                                        <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{label}</div>
                                        <div style={{ fontSize: 8,  color: "#333", marginTop: 1 }}>{hint}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


                {/* ── H2H MATCHUPS ──────────────────────────────────────────── */}
                {activeTab === "matchups" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                            {([
                                { title: `${t2.short} bowling — danger vs ${t1.short}`, bowlers: dangerT2Bowl, col: t2.color },
                                { title: `${t1.short} bowling — danger vs ${t2.short}`, bowlers: dangerT1Bowl, col: t1.color },
                            ]).map(({ title, bowlers, col }) => (
                                <div key={title} style={{ background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                                    <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                        letterSpacing: "0.12em", fontWeight: 600, marginBottom: 12 }}>
                                        ⚠ {title}
                                    </div>
                                    {bowlers.length === 0 && (
                                        <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 14 }}>No data</div>
                                    )}
                                    {bowlers.map((b: any, i: number) => (
                                        <div key={b.player_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                                            borderBottom: i < bowlers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${col}20`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 10, fontWeight: 700, color: col, flexShrink: 0 }}>
                                                {i + 1}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700 }}>{b.player_name}</div>
                                                <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>
                                                    Eco: <span style={{ color: "#777" }}>{b.ewma_economy}</span> · SR: <span style={{ color: "#777" }}>{b.suppression_sr}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                                                    {Math.round(b.danger_score * 100)}
                                                </div>
                                                <div style={{ fontSize: 8, color: "#444" }}>danger</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* H2H insights */}
                        {h2hInsights.length > 0 ? (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                    letterSpacing: "0.12em", fontWeight: 600, marginBottom: 8 }}>
                                    ⚡ Key Batter vs Bowler Matchups
                                </div>
                                {h2hInsights.map((ins: any, i: number) => {
                                    const tc = ins.team_ref === "team_1" ? t1.color : t2.color;
                                    return (
                                        <div key={i} style={{
                                            background: "rgba(255,255,255,0.03)",
                                            border: `1px solid rgba(255,255,255,0.04)`,
                                            borderLeft: `3px solid ${tc}`,
                                            borderRadius: "0 12px 12px 0",
                                            padding: "10px 12px", marginBottom: 6,
                                            display: "flex", alignItems: "flex-start", gap: 8 }}>
                                            <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", gap: 6, marginBottom: 3,
                                                    alignItems: "center", flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 9, color: tc, fontWeight: 700,
                                                        textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                                        H2H Alert
                                                    </span>
                                                    <span style={{ fontSize: 9, color: "#444" }}>
                                                        {ins.team_ref === "team_1" ? t1.short : t2.short}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.4 }}>{ins.text}</div>
                                                {ins.supporting_data && (
                                                    <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                                        {["h2h_sr", "balls_faced", "player_mean_sr"].map(k => {
                                                            const v = ins.supporting_data[k];
                                                            if (v == null) return null;
                                                            return (
                                                                <div key={k} style={{ fontSize: 9 }}>
                                                                    <span style={{ color: "#444" }}>
                                                                        {k.replace(/_/g, " ")}:{" "}
                                                                    </span>
                                                                    <span style={{ color: tc, fontFamily: "monospace", fontWeight: 600 }}>
                                                                        {String(v)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: tc,
                                                fontFamily: "monospace", flexShrink: 0 }}>
                                                {Math.round(ins.strength_score * 100)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", padding: "24px 0", color: "#444" }}>
                                <div style={{ fontSize: 20, marginBottom: 6 }}>⚡</div>
                                <div style={{ fontSize: 12 }}>No H2H matchup data available.</div>
                            </div>
                        )}
                    </div>
                )}


                {/* ── VENUE INTEL ───────────────────────────────────────────── */}
                {activeTab === "venue" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: 12, marginBottom: 12 }}>
                            {/* Toss donuts */}
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
                                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                    letterSpacing: "0.12em", fontWeight: 600, marginBottom: 14 }}>
                                    🪙 Toss Advantage at This Venue
                                </div>
                                {tossStats ? (() => {
                                    const batPct   = tossStats.bat_first?.pct    ?? Math.round((tossStats.choose_bat?.win_pct    ?? 0.5) * 100);
                                    const fieldPct = tossStats.field_first?.pct ?? Math.round((tossStats.choose_field?.win_pct ?? 0.5) * 100);
                                    const batN     = tossStats.bat_first?.matches    ?? tossStats.choose_bat?.total    ?? "?";
                                    const fieldN   = tossStats.field_first?.matches ?? tossStats.choose_field?.total ?? "?";
                                    const total    = tossStats.sample_size ?? "?";
                                    return (
                                        <div>
                                            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 10 }}>
                                                {([
                                                    { label: "Bat first", pct: batPct, n: batN, color: "#f59e0b" },
                                                    { label: "Field first", pct: fieldPct, n: fieldN, color: "#60a5fa" },
                                                ] as { label: string; pct: number; n: any; color: string }[]).map(({ label, pct, n, color }) => {
                                                    const r = 20, circ = 2 * Math.PI * r, dash = circ * (pct / 100);
                                                    return (
                                                        <div key={label} style={{ textAlign: "center" }}>
                                                            <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 6px" }}>
                                                                <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
                                                                    <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                                                                    <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth="4"
                                                                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                                                                        style={{ transition: "stroke-dasharray 1s ease" }} />
                                                                </svg>
                                                                <div style={{ position: "absolute", inset: 0, display: "flex",
                                                                    alignItems: "center", justifyContent: "center",
                                                                    fontSize: 11, fontWeight: 700, color, fontFamily: "'Space Mono',monospace" }}>
                                                                    {pct}%
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: 10, color: "#666" }}>{label}</div>
                                                            <div style={{ fontSize: 9, color: "#444" }}>{n} matches</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ fontSize: 9, color: "#444", textAlign: "center" }}>
                                                Based on {total} matches
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 14 }}>
                                        Toss stats not available
                                    </div>
                                )}
                            </div>

                            {/* Weather */}
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
                                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                    letterSpacing: "0.12em", fontWeight: 600, marginBottom: 12 }}>🌤 Match Day Weather</div>
                                {([
                                    { icon: "🌡", label: "Temperature", val: `${matchData.match_info.weather?.temp}°C`,
                                        note: (matchData.match_info.weather?.temp ?? 0) > 35 ? "Extreme heat" : "Comfortable" },
                                    { icon: "💧", label: "Humidity", val: `${matchData.match_info.weather?.humidity}%`,
                                        note: (matchData.match_info.weather?.humidity ?? 0) > 70 ? "High — dew likely" : "Low dew risk" },
                                    { icon: "🌧", label: "Precipitation", val: `${matchData.match_info.weather?.rain}mm`,
                                        note: (matchData.match_info.weather?.rain ?? 0) > 0 ? "Rain possible" : "Dry conditions" },
                                ] as { icon: string; label: string; val: string; note: string }[]).map(({ icon, label, val, note }) => (
                                    <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                                        <span style={{ fontSize: 16 }}>{icon}</span>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 600 }}>
                                                {label}: <span style={{ color: "#fff" }}>{val}</span>
                                            </div>
                                            <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{note}</div>
                                        </div>
                                    </div>
                                ))}
                                {sc.rain_scenario && sc.rain_scenario.rain_favours !== "neutral" && (
                                    <div style={{ marginTop: 10, padding: "6px 8px", background: "rgba(96,165,250,0.08)",
                                        borderRadius: 8, border: "1px solid rgba(96,165,250,0.15)", fontSize: 9, color: "#60a5fa" }}>
                                        Rain scenario: WP shifts {sc.rain_scenario.delta_team1 > 0 ? "+" : ""}
                                        {Math.round(sc.rain_scenario.delta_team1 * 100)}% for {t1.short}
                                    </div>
                                )}
                            </div>
                        </div>

                        {sc.venue_history?.length > 0 && (
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
                                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase",
                                    letterSpacing: "0.12em", fontWeight: 600, marginBottom: 12 }}>
                                    🏟 Last {sc.venue_history.length} Matches at This Venue
                                </div>

                                {/* Header row */}
                                <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 90px 60px",
                                    padding: "0 0 6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    marginBottom: 4 }}>
                                    {["Date", "Teams", "Scores", "Winner"].map(h => (
                                        <span key={h} style={{ fontSize: 9, color: "#444", textTransform: "uppercase",
                                            letterSpacing: "0.08em" }}>{h}</span>
                                    ))}
                                </div>

                                {sc.venue_history.map((m: any, i: number) => {
                                    const name1      = resolveTeamName(m.team1,  team1Key, team2Key, teamIdLookup);
                                    const name2      = resolveTeamName(m.team2,  team1Key, team2Key, teamIdLookup);
                                    const nameWinner = resolveTeamName(m.winner, team1Key, team2Key, teamIdLookup);
                                    const winner1    = nameWinner === name1;
                                    const c1 = getTeam(name1);
                                    const c2 = getTeam(name2);
                                    return (
                                        <div key={i} style={{
                                            display: "grid",
                                            gridTemplateColumns: "64px 1fr 90px 60px",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "8px 0",
                                            borderBottom: i < sc.venue_history.length - 1
                                                ? "1px solid rgba(255,255,255,0.04)" : "none",
                                        }}>
                                            {/* Date */}
                                            <span style={{ fontSize: 9, color: "#444" }}>{m.date}</span>

                                            {/* Teams */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden" }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 600,
                                                    color: winner1 ? "#22c55e" : c1.color + "99",
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                }}>{name1}</span>
                                                <span style={{ color: "#333", fontSize: 9, flexShrink: 0 }}>vs</span>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 600,
                                                    color: !winner1 ? "#22c55e" : c2.color + "99",
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                }}>{name2}</span>
                                            </div>

                                            {/* Scores */}
                                            <div style={{ display: "flex", gap: 3, fontSize: 10, fontFamily: "monospace",
                                                alignItems: "center", whiteSpace: "nowrap" }}>
                                                <span style={{ color: "#666" }}>{m.s1}</span>
                                                <span style={{ color: "#333" }}>→</span>
                                                <span style={{ color: "#666" }}>{m.s2}</span>
                                            </div>

                                            {/* Winner */}
                                            <span style={{ fontSize: 10, color: "#22c55e", whiteSpace: "nowrap" }}>
                                                {nameWinner} ✓
                                            </span>
                                        </div>
                                    );
                                })}

                                <div style={{ marginTop: 10, fontSize: 10, color: "#444" }}>
                                    Avg 1st innings:{" "}
                                    {Math.round(
                                        sc.venue_history.reduce((a: number, m: any) => a + (m.s1 || 0), 0) /
                                        sc.venue_history.length
                                    )} runs
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* ── INSIGHTS ─────────────────────────────────────────────── */}
                {activeTab === "insights" && (
                    <div>
                        {sc.debutants_flagged?.length > 0 && (
                            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
                                borderRadius: 12, padding: "10px 12px", marginBottom: 12,
                                display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 16 }}>⚠</span>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
                                        Debutant Alert — Limited Data
                                    </div>
                                    <div style={{ fontSize: 10, color: "#78716c", marginTop: 1 }}>
                                        {sc.debutants_flagged.join(", ")} — predictions use population averages
                                    </div>
                                </div>
                            </div>
                        )}
                        {allInsights.length > 0 ? allInsights.map((ins: any, i: number) => {
                            const tc   = ins.team_ref === "team_1" ? t1.color : t2.color;
                            const icon = ({ H2H_ALERT:"⚡", FORM_SPIKE:"📈", VENUE_PLAYER_TREND:"🏟", TOSS_EDGE:"🪙" } as any)[ins.type] ?? "•";
                            return (
                                <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${tc}20`,
                                    borderRadius: 16, padding: 14, marginBottom: 10 }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                        <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 9, color: tc, fontWeight: 700,
                                                    textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                                    {ins.type.replace(/_/g, " ")}
                                                </span>
                                                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8,
                                                    background: `${tc}15`, color: tc }}>
                                                    {ins.team_ref === "team_1" ? t1.short : t2.short}
                                                </span>
                                                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700,
                                                    color: tc, fontFamily: "monospace" }}>
                                                    {Math.round(ins.strength_score * 100)}/100
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5 }}>{ins.text}</div>
                                            {ins.supporting_data && (
                                                <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                    {Object.entries(ins.supporting_data)
                                                        .filter(([k]) => !["sparkline","player_id","batter_id","bowler_id"].includes(k))
                                                        .map(([k, v]) => (
                                                            <div key={k} style={{ fontSize: 9 }}>
                                                                <span style={{ color: "#444" }}>
                                                                    {k.replace(/_/g, " ")}:{" "}
                                                                </span>
                                                                <span style={{ color: "#888", fontFamily: "monospace" }}>{String(v)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
                                <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
                                <div style={{ fontSize: 12 }}>No insights generated yet.</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// MATCH LIST PAGE
// ─────────────────────────────────────────────────────────────────────────────

function MatchListPage({ onSelectMatch }: { onSelectMatch: (m: any) => void }) {
    return (
        <div style={{ minHeight: "100vh", background: "#080c14", color: "#e8eaf0",
            fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: "18px 12px" }}>
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.2em",
                        textTransform: "uppercase", marginBottom: 6 }}>IPL 2026 · Predictive Engine</div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0,
                        background: "linear-gradient(135deg, #fff 40%, #666)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Match Predictions
                    </h1>
                    <p style={{ fontSize: 12, color: "#444", marginTop: 4 }}>
                        Roster-centric ML predictions · Updated pre-toss
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {LOADED_MATCHES.map((m) => {
                        const t1 = getTeam(m.team1);
                        const t2 = getTeam(m.team2);
                        return (
                            <div key={m.id} onClick={() => onSelectMatch(m)}
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.07)", 
                                    borderRadius: 12,
                                    padding: "12px 14px", cursor: "pointer",
                                    transition: "border-color 0.2s",
                                    display: "flex", alignItems: "center", gap: 12, 
                                    justifyContent: "space-between", flexWrap: "wrap"
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>

                                {/* LEFT SECTION: Flex 1 */}
                                <div style={{ flex: "1 1 0%", minWidth: 200, display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ minWidth: 30, paddingRight: 12,
                                        borderRight: "1px solid rgba(255,255,255,0.08)",
                                        fontSize: 11, fontWeight: 700, color: "#333",
                                        fontFamily: "'Space Mono',monospace", textAlign: "center", flexShrink: 0 }}>
                                        {m.match_number}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                        <TeamLogo team={t1} size={32} />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: t1.color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.team1}</span>
                                        <span style={{ color: "#333", fontSize: 11, flexShrink: 0, margin: "0 4px" }}>vs</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: t2.color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.team2}</span>
                                        <TeamLogo team={t2} size={32} />
                                    </div>
                                </div>

                                {/* CENTER SECTION: Absolute width, pushes perfectly to the center */}
                                {m.team1_wp != null ? (
                                    <div style={{ width: 130, flexShrink: 0, margin: "0 auto" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 30px",
                                            alignItems: "center", gap: 4, fontSize: 9, fontFamily: "monospace" }}>
                                            <span style={{ color: t1.color }}>{Math.round(m.team1_wp * 100)}%</span>
                                            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                                <div style={{ display: "flex", height: "100%" }}>
                                                    <div style={{ width: `${m.team1_wp * 100}%`, background: t1.color, borderRadius: "2px 0 0 2px" }} />
                                                    <div style={{ flex: 1, background: t2.color, borderRadius: "0 2px 2px 0" }} />
                                                </div>
                                            </div>
                                            <span style={{ color: t2.color, textAlign: "right" }}>{Math.round(m.team2_wp * 100)}%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ width: 130, flexShrink: 0 }} /> // Spacer for consistency
                                )}

                                {/* RIGHT SECTION: Flex 1 */}
                                <div style={{ flex: "1 1 0%", textAlign: "right", minWidth: 100, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                    <div style={{ fontSize: 10, color: "#666" }}>{m.date}</div>
                                    <div style={{ fontSize: 9, color: "#444", marginTop: 1,
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                                        {cleanVenueName(m.venue)}
                                    </div>
                                    <div style={{ fontSize: 9, color: "#22c55e", marginTop: 2, fontWeight: 600 }}>● Predicted</div>
                                </div>

                            </div>
                        );
                    })}

                    {LOADED_MATCHES.length === 0 && (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "#444" }}>
                            <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                            <div style={{ fontSize: 12 }}>No match files found in <code style={{ color: "#666", fontSize: 10 }}>data/</code></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// POINTS TABLE PAGE
// ─────────────────────────────────────────────────────────────────────────────

// ACTUAL TABLE without NRR
const ACTUAL_TABLE = [
    { team: "SRH",  m: 5, w: 4, l: 1, pts: 8 },
    { team: "RCB",  m: 5, w: 3, l: 2, pts: 6 },
    { team: "KKR",  m: 5, w: 3, l: 2, pts: 6 },
    { team: "MI",   m: 5, w: 3, l: 2, pts: 6 },
    { team: "CSK",  m: 5, w: 2, l: 3, pts: 4 },
    { team: "GT",   m: 5, w: 2, l: 3, pts: 4 },
    { team: "DC",   m: 5, w: 2, l: 3, pts: 4 },
    { team: "PBKS", m: 5, w: 2, l: 3, pts: 4 },
    { team: "RR",   m: 5, w: 1, l: 4, pts: 2 },
    { team: "LSG",  m: 5, w: 0, l: 5, pts: 0 },
];

// Dynamically generate PREDICTED_TABLE by taking the actual table
// and adding the predicted outcomes from the 5 newest JSON files
const PREDICTED_TABLE = ACTUAL_TABLE.map(row => ({ ...row }));

LOADED_MATCHES.slice(-5).forEach(m => {
    if (m.team1_wp != null && m.team2_wp != null) {
        // Find winner based on higher win probability
        const predictedWinner = m.team1_wp >= m.team2_wp ? m.team1 : m.team2;
        const predictedLoser  = m.team1_wp >= m.team2_wp ? m.team2 : m.team1;

        const wRow = PREDICTED_TABLE.find(r => r.team === predictedWinner);
        const lRow = PREDICTED_TABLE.find(r => r.team === predictedLoser);

        if (wRow) { wRow.m += 1; wRow.w += 1; wRow.pts += 2; }
        if (lRow) { lRow.m += 1; lRow.l += 1; }
    }
});

// Re-sort predicted table by Points then Wins (since NRR is removed)
PREDICTED_TABLE.sort((a, b) => b.pts - a.pts || b.w - a.w);

function PointsTablePage() {
    return (
        <div style={{ minHeight: "100vh", background: "#080c14", color: "#e8eaf0",
            fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: "18px 12px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.2em",
                        textTransform: "uppercase", marginBottom: 6 }}>IPL 2026</div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0,
                        background: "linear-gradient(135deg, #fff 40%, #666)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Points Table
                    </h1>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                    {([
                        { title: "🤖 Predicted Standings", subtitle: "Model's projected table", data: PREDICTED_TABLE, ac: "#6366f1" },
                        { title: "🏏 Actual Standings",    subtitle: "Live IPL 2026 table",     data: ACTUAL_TABLE,    ac: "#22c55e" },
                    ] as { title: string; subtitle: string; data: typeof PREDICTED_TABLE; ac: string }[]).map(({ title, subtitle, data, ac }) => (
                        <div key={title} style={{ background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                            <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
                                <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{subtitle}</div>
                            </div>
                            <div style={{ padding: "0 6px", overflowX: "auto" }}>
                                
                                {/* Header Row Added Here */}
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "20px 1fr 30px 30px 30px 38px",
                                    padding: "8px 10px", alignItems: "center",
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    marginBottom: 8, fontSize: 10, color: "#888", 
                                    fontWeight: 600, textTransform: "uppercase"
                                }}>
                                    <span>#</span>
                                    <span>Team</span>
                                    <span style={{ textAlign: "center" }}>M</span>
                                    <span style={{ textAlign: "center" }}>W</span>
                                    <span style={{ textAlign: "center" }}>L</span>
                                    <span style={{ textAlign: "center" }}>Pts</span>
                                </div>

                                {data.map((row, i) => {
                                    const t      = TEAM_CONFIG[row.team] ?? getTeam(row.team);
                                    const tc     = t?.color ?? "#888";
                                    const isTop4 = i < 4;
                                    return (
                                        <div key={row.team} style={{
                                            display: "grid",
                                            gridTemplateColumns: "20px 1fr 30px 30px 30px 38px",
                                            padding: "8px 10px", alignItems: "center",
                                            borderRadius: 8, marginBottom: 2,
                                            background: isTop4 ? `${ac}08` : "transparent",
                                            borderLeft: isTop4 ? `2px solid ${ac}40` : "2px solid transparent",
                                            fontSize: "12px" }}>
                                            <span style={{ fontSize: 10, color: isTop4 ? ac : "#555",
                                                fontWeight: isTop4 ? 700 : 400 }}>{i + 1}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <TeamLogo team={t} size={22} />
                                                <span style={{ fontSize: 11, fontWeight: isTop4 ? 600 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{row.team}</span>
                                            </div>
                                            {[row.m, row.w, row.l].map((v, vi) => (
                                                <span key={vi} style={{ textAlign: "center", fontSize: 11, color: "#666" }}>{v}</span>
                                            ))}
                                            <span style={{ textAlign: "center", fontSize: 12, fontWeight: 700,
                                                color: isTop4 ? ac : "#888", fontFamily: "'Space Mono',monospace" }}>
                                                {row.pts}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div style={{ padding: "6px 10px 10px", display: "flex", alignItems: "center",
                                    gap: 5, fontSize: 9, color: "#333" }}>
                                    <div style={{ width: 8, height: 2, background: ac, borderRadius: 1 }} />
                                    Top 4 qualify
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function IPLDashboard() {
    const [page, setPage]                   = useState("matches");
    const [selectedMatch, setSelectedMatch] = useState<any>(null);

    return (
        <div style={{ height: "100vh", overflow: "hidden" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #080c14; }
            `}</style>

            <div style={{ height: "100vh", overflowY: page === "detail" ? "hidden" : "auto" }}>
                {page === "matches" && (
                    <MatchListPage onSelectMatch={(m: any) => { setSelectedMatch(m); setPage("detail"); }} />
                )}
                {page === "detail" && selectedMatch && (
                    <MatchDetailPage
                        matchData={selectedMatch._raw}
                        team1Key={selectedMatch.team1}
                        team2Key={selectedMatch.team2}
                        onBack={() => { setPage("matches"); setSelectedMatch(null); }}
                    />
                )}
                {page === "table" && <PointsTablePage />}
            </div>

            {/* Bottom navigation */}
            <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)",
                background: "rgba(20,24,32,0.97)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
                padding: "5px 5px", display: "flex", gap: 3, zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {([
                    { key: "matches", label: "Matches",      icon: "🏏" },
                    { key: "table",   label: "Points Table", icon: "📊" },
                ] as { key: string; label: string; icon: string }[]).map(({ key, label, icon }) => (
                    <button key={key}
                        onClick={() => { setPage(key); setSelectedMatch(null); }}
                        style={{ padding: "7px 16px", borderRadius: 12, border: "none",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                            background: page === key && page !== "detail" ? "rgba(255,255,255,0.1)" : "transparent",
                            color: page === key && page !== "detail" ? "#fff" : "#555",
                            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                        <span>{icon}</span> <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}