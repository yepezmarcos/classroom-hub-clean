"use client";

import React, { useEffect, useMemo, useState } from "react";

type LevelsResponse = {
  levels: Array<"E" | "G" | "S" | "NS" | "NextSteps" | "END">;
  emoji: Record<string, string>;
};

type Suggestion = {
  id: string | number;
  text: string;
  // other fields are fine – we only need these two for UI
};

type Props = {
  /**
   * If your API runs on another origin (e.g., :4000), set this.
   * Otherwise it will try NEXT_PUBLIC_API_BASE or '' (same origin).
   */
  apiBase?: string;
  /**
   * Optional callback when user clicks "Insert".
   * If omitted, we copy to clipboard and show a toast.
   */
  onInsert?: (text: string) => void;
  /**
   * Optionally preselect a skill (slug) and/or level
   */
  initialSkill?: string;
  initialLevel?: LevelsResponse["levels"][number] | "";
};

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function joinBase(base: string | undefined, path: string) {
  const b = (base ?? process.env.NEXT_PUBLIC_API_BASE ?? "") as string;
  if (!b) return path; // same origin
  return `${b.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default function CommentGenerator({
  apiBase,
  onInsert,
  initialSkill,
  initialLevel = "",
}: Props) {
  // ---------- State ----------
  const [skills, setSkills] = useState<string[]>([
    // fallback if /settings unavailable
    "responsibility",
    "organization",
    "independent-work",
    "collaboration",
    "initiative",
    "self-regulation",
  ]);
  const [levels, setLevels] = useState<LevelsResponse["levels"]>([
    "E",
    "G",
    "S",
    "NS",
    "NextSteps",
    "END",
  ]);
  const [emoji, setEmoji] = useState<Record<string, string>>({
    E: "🟢",
    G: "🟡",
    S: "🟠",
    NS: "🔴",
    NextSteps: "🧭",
    END: "🏁",
  });

  const [selectedSkill, setSelectedSkill] = useState<string>(
    initialSkill ?? skills[0]
  );
  const [selectedLevel, setSelectedLevel] = useState<
    LevelsResponse["levels"][number] | ""
  >(initialLevel);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // “Add to Bank” form
  const [newText, setNewText] = useState("");
  const [newLevel, setNewLevel] =
    useState<LevelsResponse["levels"][number] | "">("");

  // Generate form
  const [genSubject, setGenSubject] = useState("");
  const [genGradeBand, setGenGradeBand] = useState("");
  const [genLevel, setGenLevel] =
    useState<LevelsResponse["levels"][number] | "">("");
  const [genTone, setGenTone] = useState<
    "positive" | "formal" | "growth" | "concise"
  >("growth");
  const [genLength, setGenLength] = useState<"short" | "medium" | "long">(
    "short"
  );
  const [genText, setGenText] = useState("");

  // ---------- Load levels + emoji ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(joinBase(apiBase, "/comments/levels"));
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as LevelsResponse;
        if (!cancelled) {
          setLevels(data.levels);
          setEmoji(data.emoji || {});
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // ---------- Load skills from Settings (if available) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(joinBase(apiBase, "/settings")); // your API may already have this
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const ls = Array.isArray(data?.lsCategories)
          ? data.lsCategories.map((s: any) => slugify(String(s)))
          : [];
        const uniq = Array.from(new Set(ls)).filter(Boolean);
        if (uniq.length && !cancelled) {
          setSkills(uniq);
          if (!initialSkill) setSelectedSkill(uniq[0]);
        }
      } catch {
        // ignore; we keep the fallback list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, initialSkill]);

  // ---------- Load suggestions whenever filters change ----------
  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (selectedSkill) {
        const lvl = selectedLevel ? `&level=${encodeURIComponent(selectedLevel)}` : "";
        url = joinBase(
          apiBase,
          `/comments/by-skill?skill=${encodeURIComponent(selectedSkill)}${lvl}`
        );
      } else {
        const query = q ? `?q=${encodeURIComponent(q)}` : "";
        const lvl = selectedLevel
          ? (query ? "&" : "?") + `level=${encodeURIComponent(selectedLevel)}`
          : "";
        url = joinBase(apiBase, `/comments${query}${lvl}`);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Suggestion[];
      setSuggestions(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load suggestions");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkill, selectedLevel]);

  // ---------- Helpers ----------
  function skillChipClass(active: boolean) {
    return `px-3 py-1 rounded-full border text-sm cursor-pointer ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`;
  }

  function levelChipClass(active: boolean) {
    return `px-2 py-1 rounded-full border text-sm cursor-pointer ${
      active
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`;
  }

  async function handleInsert(text: string) {
    if (onInsert) {
      onInsert(text);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
      setTimeout(() => setToast(null), 1600);
    } catch {
      setToast("Copy failed");
      setTimeout(() => setToast(null), 1600);
    }
  }

  async function handleAddToBank() {
    const text = newText.trim();
    if (!text) return setToast("Enter text first");
    const tags = [
      `category:${selectedSkill}`,
      "ontario", // optional
      ...(newLevel ? [`level:${newLevel}`] : []),
    ];
    try {
      const res = await fetch(joinBase(apiBase, "/comments"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          subject: null,
          gradeBand: null,
          tags,
          level: newLevel || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewText("");
      setNewLevel("");
      setToast("Saved to bank");
      setTimeout(() => setToast(null), 1200);
      fetchSuggestions();
    } catch (e: any) {
      setToast(e?.message || "Save failed");
      setTimeout(() => setToast(null), 1600);
    }
  }

  async function handleGenerate() {
    try {
      const res = await fetch(joinBase(apiBase, "/comments/generate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: genSubject || null,
          gradeBand: genGradeBand || null,
          level: genLevel || undefined,
          tone: genTone,
          length: genLength,
          placeholders: ["{{student_first}}", "{{next_step}}"],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGenText(data?.text || "");
    } catch (e: any) {
      setToast(e?.message || "Generate failed");
      setTimeout(() => setToast(null), 1600);
    }
  }

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-black text-white text-sm px-3 py-2 rounded-md shadow">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Skills */}
        <div className="md:col-span-2">
          <div className="mb-2 font-medium text-sm text-gray-700">Skills</div>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <button
                key={s}
                className={skillChipClass(selectedSkill === s)}
                onClick={() => setSelectedSkill(s)}
                type="button"
              >
                {titleFromSlug(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Levels */}
        <div>
          <div className="mb-2 font-medium text-sm text-gray-700">Level</div>
          <div className="flex flex-wrap gap-2">
            <button
              className={levelChipClass(selectedLevel === "")}
              onClick={() => setSelectedLevel("")}
              type="button"
            >
              All
            </button>
            {levels.map((lv) => (
              <button
                key={lv}
                className={levelChipClass(selectedLevel === lv)}
                onClick={() => setSelectedLevel(lv)}
                type="button"
                title={lv}
              >
                <span className="mr-1">{emoji[lv] ?? ""}</span>
                {lv}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Search text…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            // free-text search ignores skill; we keep level if set
            setSelectedSkill("");
            fetchSuggestions();
          }}
          type="button"
        >
          Search
        </button>
      </div>

      {/* Suggestions */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">
            {selectedSkill
              ? `${titleFromSlug(selectedSkill)}${
                  selectedLevel ? ` • ${selectedLevel}` : ""
                }`
              : q
              ? `Results for “${q}”`
              : "All comments"}
          </div>
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <ul className="divide-y">
          {suggestions.length === 0 && !loading ? (
            <li className="px-4 py-6 text-sm text-gray-500">No results.</li>
          ) : (
            suggestions.map((s) => (
              <li key={String(s.id)} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 whitespace-pre-wrap">{s.text}</div>
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                    onClick={() => handleInsert(s.text)}
                    type="button"
                  >
                    Insert
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Add to Bank */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b font-medium">Add to Comment Bank</div>
        <div className="p-4 space-y-3">
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[90px]"
            placeholder="Type a new comment (you can use {{student_first}}, {{next_step}})…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-600">Skill:</div>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  key={`add-${s}`}
                  className={skillChipClass(selectedSkill === s)}
                  onClick={() => setSelectedSkill(s)}
                  type="button"
                >
                  {titleFromSlug(s)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-gray-600">Level:</div>
            <select
              className="border rounded-lg px-2 py-1"
              value={newLevel}
              onChange={(e) =>
                setNewLevel(e.target.value as LevelsResponse["levels"][number] | "")
              }
            >
              <option value="">(none)</option>
              {levels.map((lv) => (
                <option key={`new-${lv}`} value={lv}>
                  {emoji[lv] ?? ""} {lv}
                </option>
              ))}
            </select>
            <button
              className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleAddToBank}
              type="button"
            >
              Save to bank
            </button>
          </div>
        </div>
      </div>

      {/* AI Generate (optional) */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b font-medium">AI: Generate one sentence</div>
        <div className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Subject (optional)"
              value={genSubject}
              onChange={(e) => setGenSubject(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Grade band (optional)"
              value={genGradeBand}
              onChange={(e) => setGenGradeBand(e.target.value)}
            />
            <select
              className="border rounded-lg px-3 py-2"
              value={genLevel}
              onChange={(e) =>
                setGenLevel(e.target.value as LevelsResponse["levels"][number] | "")
              }
            >
              <option value="">(no level)</option>
              {levels.map((lv) => (
                <option key={`gen-${lv}`} value={lv}>
                  {emoji[lv] ?? ""} {lv}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className="border rounded-lg px-3 py-2 flex-1"
                value={genTone}
                onChange={(e) =>
                  setGenTone(e.target.value as "positive" | "formal" | "growth" | "concise")
                }
              >
                <option value="growth">Tone: Growth</option>
                <option value="positive">Tone: Positive</option>
                <option value="formal">Tone: Formal</option>
                <option value="concise">Tone: Concise</option>
              </select>
              <select
                className="border rounded-lg px-3 py-2"
                value={genLength}
                onChange={(e) =>
                  setGenLength(e.target.value as "short" | "medium" | "long")
                }
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleGenerate}
              type="button"
            >
              Generate
            </button>
            {genText && (
              <button
                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                onClick={() => handleInsert(genText)}
                type="button"
              >
                Insert
              </button>
            )}
          </div>
          {genText && (
            <div className="mt-2 p-3 rounded-lg bg-gray-50 border whitespace-pre-wrap">
              {genText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}