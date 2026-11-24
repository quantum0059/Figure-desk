import React, { useEffect, useState } from "react";
import { concepts } from "./concepts.mjs";

function Mark() {
  return (
    <svg
      width="35"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="#195e4b" />
      <path d="M8 25 17 8l10 17Z" stroke="white" strokeWidth="2" />
      <circle cx="23" cy="21" r="6" stroke="#b8f28e" strokeWidth="2" />
    </svg>
  );
}
function Blueprint() {
  return (
    <svg className="blueprint" viewBox="0 0 400 180" aria-hidden="true">
      <defs>
        <pattern id="mesh" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke="#96bfaa" opacity=".22" />
        </pattern>
      </defs>
      <rect width="400" height="180" fill="url(#mesh)" />
      <g stroke="#b5e8a0" fill="none">
        <circle cx="185" cy="95" r="68" strokeDasharray="4 6" opacity=".65" />
        <path
          d="M115 144 V45 L281 144 Z"
          fill="#c1f4ac"
          fillOpacity=".08"
          strokeWidth="2.5"
        />
        <path d="M115 130h14v14M105 34v119m-4-108h26m-26 99h202" opacity=".6" />
      </g>
      {[
        [115, 45],
        [115, 144],
        [281, 144],
      ].map(([x, y]) => (
        <circle key={x + "-" + y} cx={x} cy={y} r="4" fill="#dbffb3" />
      ))}
      <g fill="#dcf5cb" fontStyle="italic" fontFamily="Georgia" fontSize="19">
        <text x="90" y="99">
          a
        </text>
        <text x="189" y="167">
          b
        </text>
        <text x="211" y="91">
          c
        </text>
      </g>
    </svg>
  );
}
function preview(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
const storageKey = "figure-desk:v1";
const blank = () => ({ runs: {}, reviews: {} });
export default function Studio({ saved }) {
  const [data, setData] = useState(blank),
    [ready, setReady] = useState(false),
    [filter, setFilter] = useState("All"),
    [subject, setSubject] = useState("All subjects");
  const [selected, setSelected] = useState(concepts[0].id),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [storageWarning, warn] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.runs && v.reviews) setData(v);
      }
    } catch {
      warn("Saved browser reviews could not be loaded.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        warn(
          "Browser storage is unavailable. Changes will last for this session.",
        );
      }
  }, [data, ready]);
  const rows = concepts.map((c, i) => {
    const result = data.runs[c.id] || saved[i];
    const key = c.id + "/" + result.revision;
    const review = data.reviews[key] || { status: "Pending", note: "" };
    return { ...c, result, key, review };
  });
  const visible = rows.filter(
    (r) =>
      (filter === "All" || r.review.status === filter) &&
      (subject === "All subjects" || r.subject === subject),
  );
  function edit(key, patch) {
    setData((prev) => ({
      ...prev,
      reviews: {
        ...prev.reviews,
        [key]: { status: "Pending", note: "", ...prev.reviews[key], ...patch },
      },
    }));
  }
  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected }),
      });
      const payload = await res.json();
      if (!res.ok) throw Error(payload.error || "Generation failed.");
      setData((prev) => ({
        ...prev,
        runs: { ...prev.runs, [selected]: payload },
      }));
      setFilter("All");
      setSubject("All subjects");
      setMessage(
        payload.passed
          ? "Generated a new diagram, ready for review."
          : "Generation failed validation twice. Inspect the failed checks below.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <div className="bar">
          <div className="brand">
            <Mark />
            Figure Desk
          </div>
          <span className="workspace">Review workspace</span>
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="eyebrow lime">Curriculum studio</span>
            <h1>Diagram review</h1>
            <p>Generate, validate and review animated science diagrams.</p>
          </div>
          <Blueprint />
        </section>
        <section className="generator" aria-label="Live generation">
          <div className="genlabel">
            <span className="spark" aria-hidden="true">
              ✧
            </span>
            <div>
              <h2>Live generation</h2>
              <p>Run the model for one concept.</p>
            </div>
          </div>
          <div className="controls">
            <select
              aria-label="Concept to generate"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!ready || busy}
              onClick={generate}
            >
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </section>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {storageWarning && <p role="alert">{storageWarning}</p>}
        <section>
          <div className="queue">
            <h2>Review queue</h2>
            <span>
              {rows.filter((r) => r.review.status !== "Pending").length} of 5
              reviewed
            </span>
          </div>
          <div className="filters">
            <div className="tabs">
              {["All", "Pending", "Approved", "Rejected"].map((t) => (
                <button
                  key={t}
                  aria-label={
                    t +
                    " " +
                    (t === "All"
                      ? 5
                      : rows.filter((r) => r.review.status === t).length)
                  }
                  aria-pressed={filter === t}
                  onClick={() => setFilter(t)}
                >
                  {t}
                  <small>
                    {t === "All"
                      ? 5
                      : rows.filter((r) => r.review.status === t).length}
                  </small>
                </button>
              ))}
            </div>
            <select
              aria-label="Filter by subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {["All subjects", "Maths", "Physics", "Biology", "Chemistry"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </div>
          <table>
            <caption className="sr">
              Science diagrams and review decisions
            </caption>
            <thead>
              <tr>
                <th>Concept &amp; diagram</th>
                <th>Validation</th>
                <th>Reviewer decision</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ id, title, subject, result: r, key, review }) => (
                <tr key={key}>
                  <td>
                    <span className={"subject " + subject}>{subject}</span>
                    <h3>{title}</h3>
                    {r.svg ? (
                      <img
                        className="diagram"
                        src={preview(r.svg)}
                        alt={
                          title + ". " + concepts.find((c) => c.id === id).brief
                        }
                      />
                    ) : (
                      <p>Diagram withheld after validation failed.</p>
                    )}
                  </td>
                  <td>
                    <div className="checks">
                      {Object.entries(r.checks).map(([name, pass]) => (
                        <div key={name}>
                          <b
                            className={pass ? "pass" : "fail"}
                            aria-label={pass ? "Pass" : "Fail"}
                          >
                            {pass ? "✓" : "×"}
                          </b>
                          {name}
                        </div>
                      ))}
                    </div>
                    <div className="metrics">
                      {r.cost === null
                        ? "Cost —"
                        : "$" + Number(r.cost).toFixed(6)}{" "}
                      · {r.retries} retries
                    </div>
                    <small className="muted">
                      {r.model || "Reference diagram"}
                    </small>
                  </td>
                  <td>
                    <span className={"status " + review.status}>
                      {review.status}
                    </span>
                    <label htmlFor={"note-" + id}>Review note</label>
                    <textarea
                      id={"note-" + id}
                      placeholder="Add a note…"
                      value={review.note}
                      disabled={!ready}
                      onChange={(e) => edit(key, { note: e.target.value })}
                    />
                    <div className="decisions">
                      {["Approved", "Rejected"].map((s, i) => (
                        <button
                          key={s}
                          disabled={!ready || (!i && !r.passed)}
                          aria-pressed={review.status === s}
                          onClick={() => edit(key, { status: s })}
                        >
                          {i ? "Reject" : "Approve"}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p className="empty">No diagrams match these filters.</p>
          )}
        </section>
      </main>
    </>
  );
}
