import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { v4 as uuidv4 } from "uuid";
import {
  listAll,
  upsertRecord,
  deleteRecord,
  exportBackupJSON,
  importBackupJSON,
} from "./db.js";

/** utils */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resultText(net) {
  if (net > 0) return "贏";
  if (net < 0) return "輸";
  return "平";
}

function formatNetPlain(n) {
  // 顯示 NT$ 與正負號（不重複加 NT$）
  if (n > 0) return `+NT$${n}`;
  if (n < 0) return `-NT$${Math.abs(n)}`;
  return `NT$0`;
}

function safeParseStake(stakeStr) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(stakeStr || "");
  if (!m) return { base: 30, tai: 10, ok: false };
  return { base: Number(m[1]), tai: Number(m[2]), ok: true };
}

const PRESETS = ["30/10", "50/20", "100/10", "100/20", "自訂"];

export default function App() {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(new Date());
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  async function refresh() {
    const all = await listAll();
    setRecords(all);
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedStr = toDateStr(selected);

  const recordsOfDay = useMemo(() => {
    return records
      .filter((r) => r.date === selectedStr)
      .sort((a, b) => {
        // 讓新建的在上面
        const ta = a.updatedAt || a.createdAt || "";
        const tb = b.updatedAt || b.createdAt || "";
        return tb.localeCompare(ta);
      });
  }, [records, selectedStr]);

  const year = new Date().getFullYear();
  const yearRecords = useMemo(
    () => records.filter((r) => (r.date || "").startsWith(String(year))),
    [records, year]
  );

  const stats = useMemo(() => {
    let win = 0,
      loss = 0,
      net = 0;
    yearRecords.forEach((r) => {
      const n = Number(r.net || 0);
      net += n;
      if (n > 0) win += n;
      if (n < 0) loss += Math.abs(n);
    });
    return { win, loss, net };
  }, [yearRecords]);

  const dailyMap = useMemo(() => {
    const m = {};
    yearRecords.forEach((r) => {
      const k = r.date;
      const n = Number(r.net || 0);
      m[k] = (m[k] || 0) + n;
    });
    return m;
  }, [yearRecords]);

  async function handleSave(record) {
    await upsertRecord(record);
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id) {
    if (confirm("確定刪除這筆紀錄？")) {
      await deleteRecord(id);
      await refresh();
    }
  }

  async function backup() {
    const json = await exportBackupJSON();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xinyi-mahjong-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("這會覆蓋目前所有資料，確定要還原？")) return;
    await importBackupJSON(await file.text());
    await refresh();
    // 讓同一個檔案下次還能再選到
    e.target.value = "";
  }

  /** theme (neutral) */
  const theme = {
    bg: "#0b1220", // 深藍灰
    panel: "#111a2c",
    card: "#0f172a",
    card2: "#0b1324",
    border: "rgba(255,255,255,0.08)",
    text: "#e5e7eb",
    subtext: "rgba(229,231,235,0.75)",
    good: "#22c55e",
    bad: "#ef4444",
    muted: "rgba(229,231,235,0.55)",
    btn: "#1f2a44",
    btnHover: "#253252",
    primary: "#3b82f6",
  };

  const headerTitle = "信義分隊雀神戰";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        padding: 14,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
            {headerTitle}
          </div>
          <div style={{ color: theme.subtext, fontSize: 13, marginTop: 4 }}>
            只輸入當天淨值（NT$），可事後修改；資料存在瀏覽器本機，可備份/還原
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <StatCard
            theme={theme}
            title="今年總贏"
            value={`NT$${stats.win}`}
            accent={theme.good}
          />
          <StatCard
            theme={theme}
            title="今年總輸"
            value={`NT$${stats.loss}`}
            accent={theme.bad}
          />
          <StatCard
            theme={theme}
            title="淨收支"
            value={`NT$${stats.net}`}
            accent={stats.net >= 0 ? theme.good : theme.bad}
          />
        </div>

        {/* Calendar panel */}
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ marginBottom: 8, color: theme.subtext, fontSize: 13 }}>
            點日期查看/新增當日紀錄
          </div>

          <div
            style={{
              background: theme.card2,
              border: `1px solid ${theme.border}`,
              borderRadius: 14,
              padding: 10,
            }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              showOutsideDays
              styles={{
                caption: { color: theme.text, fontWeight: 700 },
                head_cell: { color: theme.muted, fontWeight: 600 },
              }}
              components={{
                Day: ({ date }) => {
                  const key = toDateStr(date);
                  const sum = dailyMap[key] || 0;

                  return (
                    <div
                      style={{
                        position: "relative",
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "flex-start",
                        padding: 6,
                        boxSizing: "border-box",
                        background:
                          key === selectedStr
                            ? "rgba(59,130,246,0.18)"
                            : "transparent",
                        border:
                          key === selectedStr
                            ? "1px solid rgba(59,130,246,0.35)"
                            : "1px solid transparent",
                      }}
                    >
                      <div style={{ fontSize: 13 }}>{date.getDate()}</div>

                      {sum !== 0 && (
                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            bottom: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            color: sum > 0 ? theme.good : theme.bad,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sum > 0 ? `+${sum}` : `-${Math.abs(sum)}`}
                        </div>
                      )}
                    </div>
                  );
                },
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button
              theme={theme}
              onClick={() => setShowForm(true)}
              primary
              label="新增紀錄"
            />
            <Button theme={theme} onClick={backup} label="備份" />
            <Button
              theme={theme}
              onClick={() => fileInputRef.current?.click()}
              label="還原"
            />
            <input type="file" hidden ref={fileInputRef} onChange={restore} />
          </div>
        </div>

        {/* List */}
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {selectedStr} 紀錄
            </div>
            <div style={{ color: theme.subtext, fontSize: 13 }}>
              共 {recordsOfDay.length} 筆
            </div>
          </div>

          {recordsOfDay.length === 0 ? (
            <div style={{ color: theme.subtext, marginTop: 10, fontSize: 13 }}>
              這天還沒有紀錄，按「新增紀錄」建立一筆。
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {recordsOfDay.map((r) => {
                const n = Number(r.net || 0);
                const badgeColor =
                  n > 0 ? theme.good : n < 0 ? theme.bad : theme.muted;
                const badgeBg =
                  n > 0
                    ? "rgba(34,197,94,0.12)"
                    : n < 0
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(229,231,235,0.10)";

                return (
                  <li
                    key={r.id}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: 14,
                      padding: 10,
                      marginBottom: 10,
                      background: theme.card,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: `1px solid ${theme.border}`,
                              color: theme.subtext,
                            }}
                          >
                            {r.location || "未填地點"}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: `1px solid ${theme.border}`,
                              color: theme.subtext,
                            }}
                          >
                            籌碼 {r.stake}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: `1px solid ${theme.border}`,
                              color: theme.subtext,
                            }}
                          >
                            {r.hands} 將
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              color: badgeColor,
                              background: badgeBg,
                              border: `1px solid ${theme.border}`,
                              fontWeight: 800,
                              marginRight: 8,
                            }}
                          >
                            {resultText(n)}
                          </span>

                          <div style={{ fontWeight: 900, fontSize: 18 }}>
                            {formatNetPlain(n)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          theme={theme}
                          label="修改"
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                        />
                        <Button
                          theme={theme}
                          label="刪除"
                          danger
                          onClick={() => handleDelete(r.id)}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Form modal */}
        {showForm && (
          <Form
            theme={theme}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSave={handleSave}
            editing={editing}
            date={selectedStr}
          />
        )}

        <div
          style={{
            maxWidth: 520,
            margin: "14px auto 0",
            color: theme.muted,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          提醒：如果你要「給朋友各自建立自己的紀錄」，最簡單是把網站網址給他們，
          他們在自己的手機打開後資料會存在他們自己的手機裡（彼此不會互通）。
          若要共用同一份資料，需要另外做登入/雲端同步（之後可再加）。
        </div>
      </div>
    </div>
  );
}

/** UI components */
function StatCard({ theme, title, value, accent }) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div style={{ color: theme.subtext, fontSize: 12, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontWeight: 900, fontSize: 18, color: accent }}>{value}</div>
    </div>
  );
}

function Button({ theme, label, onClick, primary, danger }) {
  const baseBg = primary ? theme.primary : theme.btn;
  const fg = primary ? "#ffffff" : theme.text;
  const border = primary
    ? "1px solid rgba(255,255,255,0.12)"
    : `1px solid ${theme.border}`;

  const dangerStyle = danger
    ? {
        background: "rgba(239,68,68,0.12)",
        color: theme.bad,
        border: `1px solid rgba(239,68,68,0.25)`,
      }
    : {};

  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border,
        background: baseBg,
        color: fg,
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
        ...dangerStyle,
      }}
    >
      {label}
    </button>
  );
}

/** Form (modal) */
function Form({ theme, onClose, onSave, editing, date }) {
  const [location, setLocation] = useState(editing?.location || "");
  const [hands, setHands] = useState(
    Number.isFinite(editing?.hands) ? editing.hands : 1
  );

  // net：允許輸入正負（贏正、輸負）
  const [net, setNet] = useState(
    Number.isFinite(editing?.net) ? editing.net : 0
  );

  // stake：預設或自訂
  const parsed = safeParseStake(editing?.stake || "30/10");
  const [stakeMode, setStakeMode] = useState(() => {
    const s = editing?.stake || "30/10";
    return PRESETS.includes(s) ? s : "自訂";
  });
  const [customBase, setCustomBase] = useState(parsed.base);
  const [customTai, setCustomTai] = useState(parsed.tai);

  const resolvedStake =
    stakeMode === "自訂" ? `${customBase}/${customTai}` : stakeMode;

  const netPreview = Number(net || 0);
  const result = resultText(netPreview);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 18,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            {editing ? "修改紀錄" : "新增紀錄"}
          </div>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.text,
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 800,
            }}
          >
            關閉
          </button>
        </div>

        <div style={{ color: theme.subtext, fontSize: 13, marginTop: 6 }}>
          日期：{date}
        </div>

        {/* Location */}
        <Field label="地點" theme={theme}>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例如：小明家"
            style={inputStyle(theme)}
          />
        </Field>

        {/* Stake */}
        <Field label="籌碼（底/台）" theme={theme}>
          <select
            value={stakeMode}
            onChange={(e) => setStakeMode(e.target.value)}
            style={inputStyle(theme)}
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {stakeMode === "自訂" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                type="number"
                value={customBase}
                onChange={(e) => setCustomBase(+e.target.value)}
                placeholder="底"
                style={inputStyle(theme)}
              />
              <input
                type="number"
                value={customTai}
                onChange={(e) => setCustomTai(+e.target.value)}
                placeholder="台"
                style={inputStyle(theme)}
              />
            </div>
          )}

          <div style={{ marginTop: 8, color: theme.muted, fontSize: 12 }}>
            目前籌碼：{resolvedStake}
          </div>
        </Field>

        {/* Hands */}
        <Field label="打了幾將？" theme={theme} hint="一將四圈（用數字填）">
          <input
            type="number"
            value={hands}
            min={1}
            onChange={(e) => setHands(+e.target.value)}
            style={inputStyle(theme)}
          />
        </Field>

        {/* Net */}
        <Field
          label="當天淨值（NT$）"
          theme={theme}
          hint="贏填正數；輸填負數；平填 0"
        >
          <input
            type="number"
            value={net}
            onChange={(e) => setNet(+e.target.value)}
            style={inputStyle(theme)}
          />
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${theme.border}`,
                background:
                  netPreview > 0
                    ? "rgba(34,197,94,0.12)"
                    : netPreview < 0
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(229,231,235,0.10)",
                color:
                  netPreview > 0
                    ? theme.good
                    : netPreview < 0
                    ? theme.bad
                    : theme.text,
                fontWeight: 900,
                marginRight: 8,
              }}
            >
              {result}
            </span>
            <span style={{ fontWeight: 900 }}>{formatNetPlain(netPreview)}</span>
          </div>
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button
            theme={theme}
            primary
            label={editing ? "儲存修改" : "記錄這場戰績"}
            onClick={() => {
              const record = {
                id: editing?.id || uuidv4(),
                date,
                location: (location || "").trim(),
                stake: resolvedStake,
                hands: Number(hands || 1),
                net: Number(net || 0),
                updatedAt: new Date().toISOString(),
                createdAt: editing?.createdAt || new Date().toISOString(),
              };
              onSave(record);
            }}
          />
          <Button theme={theme} label="取消" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children, theme }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{label}</div>
      {hint && (
        <div style={{ color: theme.muted, fontSize: 12, marginBottom: 8 }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function inputStyle(theme) {
  return {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    background: theme.card,
    color: theme.text,
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  };
}
