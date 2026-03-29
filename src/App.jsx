import { useState, useEffect, useRef } from "react";
import { load, save } from "./storage";
import { supabase } from "./supabase";

// ── Date helpers ──
function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function weekKey(d) { return getMonday(d).toISOString().split("T")[0]; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDay(d) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { dow: days[d.getDay()], date: `${months[d.getMonth()]} ${d.getDate()}` };
}
function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

const CATEGORIES = [
  { id: "protein", label: "Protein", emoji: "🥩" },
  { id: "veggie",  label: "Veggie",  emoji: "🥦" },
  { id: "fruit",   label: "Fruit",   emoji: "🍎" },
  { id: "dairy",   label: "Dairy",   emoji: "🧀" },
  { id: "other",   label: "Other",   emoji: "📦" },
];

const LOCATIONS = [
  { id: "freezer",         label: "Inside Freezer",  emoji: "🧊" },
  { id: "outside_freezer", label: "Outside Freezer", emoji: "❄️" },
  { id: "fridge",          label: "Fridge",          emoji: "🌡️" },
];

let idCounter = Date.now();
function uid() { return `${++idCounter}`; }

export default function KitchenHub() {
  const [tab, setTab] = useState("inventory");
  const [inventory, setInventory] = useState([]);
  const [mealPlan, setMealPlan] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Load ──
  useEffect(() => {
    (async () => {
      const [inv, mp] = await Promise.all([
        load("kitchen:inventory", []),
        load("kitchen:mealplan", {}),
      ]);
      setInventory(inv);
      setMealPlan(mp);
      setLoaded(true);
    })();
  }, []);

  // ── Auto-save ──
  useEffect(() => { if (loaded) save("kitchen:inventory", inventory); }, [inventory, loaded]);
  useEffect(() => { if (loaded) save("kitchen:mealplan", mealPlan); }, [mealPlan, loaded]);

  // ── Week nav ──
  const currentMonday = getMonday(addDays(new Date(), weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));
  const wk = weekKey(currentMonday);
  const weekLabel = `${fmtDay(weekDays[0]).date} – ${fmtDay(weekDays[6]).date}`;

  if (!loaded) return (
    <div style={S.loadWrap}><div style={S.loadDot}>Loading...</div></div>
  );

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'Outfit', sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #ccc5bd; border-radius: 3px; }
        ::placeholder { color: #b5afa8; }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>🍳</span>
          <h1 style={S.title}>Kitchen Hub</h1>
        </div>
        <nav style={S.tabs}>
          {[
            { id: "inventory", label: "Inventory", icon: "📋" },
            { id: "mealplan",  label: "Meal Plan", icon: "📅" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span> {t.label}
            </button>
          ))}
          <button onClick={() => supabase.auth.signOut()} style={S.signOutBtn}>
            Sign out
          </button>
        </nav>
      </header>

      {/* Content */}
      <main style={S.main}>
        {tab === "inventory" && (
          <InventoryView inventory={inventory} setInventory={setInventory} />
        )}
        {tab === "mealplan" && (
          <MealPlanView
            mealPlan={mealPlan} setMealPlan={setMealPlan}
            weekDays={weekDays} wk={wk} weekLabel={weekLabel}
            weekOffset={weekOffset} setWeekOffset={setWeekOffset}
            inventory={inventory}
          />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════
// INVENTORY VIEW
// ═══════════════════════════════════════════
function InventoryView({ inventory, setInventory }) {
  const [input, setInput] = useState("");
  const [loc, setLoc] = useState("freezer");
  const [cat, setCat] = useState("protein");
  const [dinners, setDinners] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dragOverLoc, setDragOverLoc] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);
  const inputRef = useRef(null);

  const addItem = () => {
    const name = input.trim();
    if (!name) return;
    const d = dinners ? parseInt(dinners) : null;
    setInventory(prev => [...prev, { id: uid(), name, location: loc, category: cat, dinners: d }]);
    setInput("");
    setDinners("");
    inputRef.current?.focus();
  };

  const removeItem = (id) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const decrementDinners = (id) => {
    setInventory(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = (item.dinners || 0) - 1;
      return next <= 0 ? null : { ...item, dinners: next };
    }).filter(Boolean));
  };

  // newCategory is optional — omit to keep the existing category
  const moveItem = (id, newLocation, newCategory = null) => {
    setInventory(prev => prev.map(item =>
      item.id === id
        ? { ...item, location: newLocation, ...(newCategory ? { category: newCategory } : {}) }
        : item
    ));
    setSelectedId(null);
    setDragOverLoc(null);
    setDragOverCat(null);
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setSelectedId(id);
  };

  // Drop onto the column background → change location only
  const handleDrop = (e, locationId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveItem(id, locationId);
  };

  // Drop onto a category group → change location AND category
  const handleDropOnCat = (e, locationId, categoryId) => {
    e.preventDefault();
    e.stopPropagation(); // don't also fire the column-level drop
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveItem(id, locationId, categoryId);
  };

  const selectedItem = selectedId ? inventory.find(i => i.id === selectedId) : null;

  const grouped = {};
  LOCATIONS.forEach(l => {
    grouped[l.id] = {};
    CATEGORIES.forEach(c => { grouped[l.id][c.id] = []; });
  });
  inventory.forEach(item => {
    if (grouped[item.location]?.[item.category]) {
      grouped[item.location][item.category].push(item);
    }
  });

  return (
    <div style={S.invRoot}>
      {/* Add bar */}
      <div style={S.addBar}>
        <div style={S.addRow}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="Add item... (e.g. chicken thighs)"
            style={S.addInput} />
          <input value={dinners} onChange={e => setDinners(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="# dinners"
            style={S.dinnersInput} />
          <button onClick={addItem} style={S.addBtn}>+ Add</button>
        </div>
        <div style={S.toggleRow}>
          <div style={S.toggleGroup}>
            {LOCATIONS.map(l => (
              <button key={l.id} onClick={() => setLoc(l.id)}
                style={{ ...S.toggle, ...(loc === l.id ? S.toggleOn : {}) }}>
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
          <div style={{ width: 16 }} />
          <div style={S.toggleGroup}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{ ...S.toggle, ...(cat === c.id ? S.toggleOnCat : {}) }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Move bar - appears when item selected */}
      {selectedItem && (
        <div style={S.moveBar}>
          <span style={S.moveLabel}>Move <b>{selectedItem.name}</b> to:</span>
          {/* Location buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {LOCATIONS.filter(l => l.id !== selectedItem.location).map(l => (
              <button key={l.id} onClick={() => moveItem(selectedId, l.id)} style={S.moveBtn}>
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
          {/* Divider */}
          <div style={{ width: 1, alignSelf: "stretch", background: "#E8E4DF", margin: "0 4px" }} />
          {/* Category buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {CATEGORIES.filter(c => c.id !== selectedItem.category).map(c => (
              <button key={c.id} onClick={() => moveItem(selectedId, selectedItem.location, c.id)} style={S.moveBtnCat}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedId(null)} style={S.moveCancelBtn}>Cancel</button>
        </div>
      )}

      {/* Inventory columns */}
      <div style={S.invColumns}>
        {LOCATIONS.map(location => {
          const locItems = grouped[location.id];
          const totalCount = Object.values(locItems).flat().length;
          const isDropTarget = dragOverLoc === location.id;
          return (
            <div key={location.id}
              onDragOver={e => { e.preventDefault(); setDragOverLoc(location.id); setDragOverCat(null); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setDragOverLoc(null); setDragOverCat(null); } }}
              onDrop={e => handleDrop(e, location.id)}
              style={{
                ...S.invCol,
                background: location.id === "freezer" ? "#EDF2F7" : location.id === "outside_freezer" ? "#E8EEF5" : "#F0F7F0",
                ...(isDropTarget ? S.colDropTarget : {}),
              }}>
              <div style={S.colHeader}>
                <span style={{ fontSize: 22 }}>{location.emoji}</span>
                <h2 style={S.colTitle}>{location.label}</h2>
                <span style={S.colCount}>{totalCount} item{totalCount !== 1 ? "s" : ""}</span>
              </div>
              <div style={S.colBody}>
                {CATEGORIES.map(category => {
                  const items = locItems[category.id];
                  if (items.length === 0) return null;
                  return (
                    <div key={category.id}
                      style={{
                        ...S.catGroup,
                        ...(dragOverLoc === location.id && dragOverCat === category.id ? S.catDropTarget : {}),
                      }}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverLoc(location.id); setDragOverCat(category.id); }}
                      onDrop={e => handleDropOnCat(e, location.id, category.id)}>
                      <div style={S.catLabel}>{category.emoji} {category.label}</div>
                      <div style={S.chipWrap}>
                        {items.map(item => (
                          <div key={item.id}
                            draggable
                            onDragStart={e => handleDragStart(e, item.id)}
                            onDragEnd={() => { setSelectedId(null); setDragOverLoc(null); setDragOverCat(null); }}
                            onClick={() => setSelectedId(prev => prev === item.id ? null : item.id)}
                            style={{
                              ...S.chip,
                              ...(item.dinners === 1 ? S.chipLow : {}),
                              ...(selectedId === item.id ? S.chipSelected : {}),
                              cursor: "grab",
                            }}>
                            <span style={S.chipText}>{item.name}</span>
                            {item.dinners != null && (
                              <span style={S.chipDinners}>
                                <button onClick={e => { e.stopPropagation(); decrementDinners(item.id); }} style={S.chipMinus}>−</button>
                                <span style={S.dinnerCount}>×{item.dinners}</span>
                              </span>
                            )}
                            <button onClick={e => { e.stopPropagation(); removeItem(item.id); }} style={S.chipX}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {totalCount === 0 && (
                  <div style={S.emptyCol}>
                    <span style={{ fontSize: 32, opacity: 0.4 }}>{location.emoji}</span>
                    <span style={{ color: "#b5afa8", marginTop: 8 }}>
                      {isDropTarget ? "Drop here!" : "Nothing here yet"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MEAL PLAN VIEW
// ═══════════════════════════════════════════
function MealPlanView({ mealPlan, setMealPlan, weekDays, wk, weekLabel, weekOffset, setWeekOffset, inventory }) {
  const [editing, setEditing] = useState(null); // { dayIdx, meal }
  const [editVal, setEditVal] = useState("");
  const [autoFillPrompt, setAutoFillPrompt] = useState(null); // { dayIdx, value }
  const editRef = useRef(null);

  const getMeal = (dayIdx, meal) => mealPlan[wk]?.[dayIdx]?.[meal] || "";

  const setMeal = (dayIdx, meal, value) => {
    setMealPlan(prev => {
      const updated = { ...prev };
      if (!updated[wk]) updated[wk] = {};
      if (!updated[wk][dayIdx]) updated[wk][dayIdx] = {};
      updated[wk][dayIdx] = { ...updated[wk][dayIdx], [meal]: value };
      return updated;
    });
  };

  const startEdit = (dayIdx, meal) => {
    setEditing({ dayIdx, meal });
    setEditVal(getMeal(dayIdx, meal));
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    if (!editing) return;
    const val = editVal.trim();
    setMeal(editing.dayIdx, editing.meal, val);

    // Auto-fill prompt for lunch
    if (editing.meal === "lunch" && val && editing.dayIdx < 6) {
      const hasEmptyLunchAfter = weekDays.slice(editing.dayIdx + 1).some(
        (_, i) => !getMeal(editing.dayIdx + 1 + i, "lunch")
      );
      if (hasEmptyLunchAfter) {
        setAutoFillPrompt({ dayIdx: editing.dayIdx, value: val });
      }
    }
    setEditing(null);
  };

  const doAutoFill = () => {
    if (!autoFillPrompt) return;
    setMealPlan(prev => {
      const updated = { ...prev };
      if (!updated[wk]) updated[wk] = {};
      for (let i = autoFillPrompt.dayIdx + 1; i < 7; i++) {
        if (!updated[wk][i]) updated[wk][i] = {};
        if (!updated[wk][i].lunch) {
          updated[wk][i] = { ...updated[wk][i], lunch: autoFillPrompt.value };
        }
      }
      return updated;
    });
    setAutoFillPrompt(null);
  };

  const clearWeek = () => {
    setMealPlan(prev => {
      const updated = { ...prev };
      delete updated[wk];
      return updated;
    });
  };

  return (
    <div style={S.mpRoot}>
      {/* Week nav */}
      <div style={S.weekNav}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={S.weekBtn}>◀</button>
        <div style={S.weekCenter}>
          <div style={S.weekLabel}>{weekLabel}</div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={S.todayBtn}>Today</button>
          )}
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} style={S.weekBtn}>▶</button>
      </div>

      {/* Auto-fill prompt */}
      {autoFillPrompt && (
        <div style={S.autoFill}>
          <span>Fill the rest of the week&apos;s lunches with <b>{autoFillPrompt.value}</b>?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={doAutoFill} style={S.autoFillYes}>Yes, fill it</button>
            <button onClick={() => setAutoFillPrompt(null)} style={S.autoFillNo}>No thanks</button>
          </div>
        </div>
      )}

      {/* Meal grid */}
      <div style={S.mealGrid}>
        {/* Header row */}
        <div style={S.gridHeaderCell} />
        <div style={{ ...S.gridHeaderCell, ...S.gridHeaderLabel }}>Lunch</div>
        <div style={{ ...S.gridHeaderCell, ...S.gridHeaderLabel }}>Dinner</div>

        {weekDays.map((day, idx) => {
          const { dow, date } = fmtDay(day);
          const today = isToday(day);
          return [
            <div key={`day-${idx}`} style={{
              ...S.dayCell,
              ...(today ? S.dayCellToday : {}),
            }}>
              <span style={S.dayDow}>{dow}</span>
              <span style={S.dayDate}>{date}</span>
            </div>,
            ...["lunch", "dinner"].map(meal => {
              const val = getMeal(idx, meal);
              const isEditing = editing?.dayIdx === idx && editing?.meal === meal;
              return (
                <div key={`${idx}-${meal}`} style={{
                  ...S.mealCell,
                  ...(today ? S.mealCellToday : {}),
                  ...(isEditing ? S.mealCellEditing : {}),
                }}>
                  {isEditing ? (
                    <input ref={editRef} value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      onBlur={commitEdit}
                      style={S.mealInput}
                      placeholder={meal === "lunch" ? "e.g. Red beans & rice" : "e.g. Nuggets + cauliflower"} />
                  ) : (
                    <div onClick={() => startEdit(idx, meal)} style={S.mealDisplay}>
                      {val || <span style={S.mealEmpty}>tap to add</span>}
                    </div>
                  )}
                </div>
              );
            }),
          ];
        })}
      </div>

      {/* Quick summary from inventory */}
      <div style={S.mpFooter}>
        <div style={S.mpHint}>
          <span style={{ fontSize: 14 }}>💡</span>
          {inventory.length > 0 ? (
            <span>You have <b>{inventory.filter(i => i.category === "protein").length}</b> proteins, <b>{inventory.filter(i => i.category === "veggie").length}</b> veggies in stock</span>
          ) : (
            <span>Add items to your inventory to see what you have on hand</span>
          )}
        </div>
        <button onClick={clearWeek} style={S.clearBtn}>Clear week</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const S = {
  root: {
    fontFamily: "'Outfit', sans-serif",
    background: "#FAF7F2",
    minHeight: "100vh",
    color: "#2D2A26",
    display: "flex",
    flexDirection: "column",
  },
  loadWrap: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#FAF7F2" },
  loadDot: { fontFamily: "'Outfit',sans-serif", color: "#b5afa8", fontSize: 16 },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid #E8E4DF",
    background: "#FFFFFF",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 28 },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 24,
    fontWeight: 600,
    color: "#2D2A26",
  },
  tabs: { display: "flex", gap: 8 },
  tab: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 20px",
    border: "2px solid #E8E4DF",
    borderRadius: 12,
    background: "transparent",
    fontFamily: "'Outfit',sans-serif",
    fontSize: 15,
    fontWeight: 500,
    color: "#8A8580",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  tabActive: {
    background: "#2D2A26",
    color: "#FAF7F2",
    borderColor: "#2D2A26",
  },
  signOutBtn: {
    padding: "8px 14px",
    border: "1.5px solid #E8E4DF",
    borderRadius: 10,
    background: "transparent",
    fontFamily: "'Outfit',sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: "#B5AFA8",
    cursor: "pointer",
    marginLeft: 4,
  },

  // Main
  main: { flex: 1, overflow: "auto", padding: 20 },

  // ── Inventory ──
  invRoot: { display: "flex", flexDirection: "column", gap: 16, height: "100%" },
  addBar: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: "1px solid #E8E4DF",
  },
  addRow: { display: "flex", gap: 10, marginBottom: 12 },
  addInput: {
    flex: 1,
    padding: "12px 16px",
    border: "2px solid #E8E4DF",
    borderRadius: 10,
    fontSize: 16,
    outline: "none",
    background: "#FAF7F2",
    transition: "border-color 0.15s",
  },
  dinnersInput: {
    width: 90,
    padding: "12px 12px",
    border: "2px solid #E8E4DF",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    background: "#FAF7F2",
    textAlign: "center",
    fontWeight: 500,
  },
  addBtn: {
    padding: "12px 24px",
    background: "#D4856A",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
    whiteSpace: "nowrap",
  },
  toggleRow: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  toggleGroup: { display: "flex", gap: 4, flexWrap: "wrap" },
  toggle: {
    padding: "7px 14px",
    border: "1.5px solid #E8E4DF",
    borderRadius: 8,
    background: "#FAF7F2",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
    color: "#8A8580",
    transition: "all 0.12s",
  },
  toggleOn: {
    background: "#4A7C8A",
    color: "#fff",
    borderColor: "#4A7C8A",
  },
  toggleOnCat: {
    background: "#6B8F5E",
    color: "#fff",
    borderColor: "#6B8F5E",
  },

  // Columns
  invColumns: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, flex: 1 },
  invCol: {
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    border: "1px solid #E8E4DF",
    transition: "all 0.15s ease",
  },
  colDropTarget: {
    border: "2px dashed #D4856A",
    transform: "scale(1.01)",
  },

  // Move bar
  moveBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    background: "#FFF8EB",
    borderRadius: 12,
    border: "1.5px solid #F0D9A0",
    fontSize: 14,
  },
  moveLabel: { color: "#6B5D3E", whiteSpace: "nowrap" },
  moveBtn: {
    padding: "6px 14px",
    background: "#4A7C8A",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
    whiteSpace: "nowrap",
  },
  moveBtnCat: {
    padding: "6px 14px",
    background: "#6B8F5E",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
    whiteSpace: "nowrap",
  },
  catDropTarget: {
    outline: "2px dashed #D4856A",
    outlineOffset: 3,
    borderRadius: 8,
  },
  moveCancelBtn: {
    padding: "6px 12px",
    background: "transparent",
    color: "#8A8580",
    border: "1.5px solid #E8E4DF",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
    marginLeft: "auto",
  },
  colHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  colTitle: { fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600 },
  colCount: { fontSize: 13, color: "#8A8580", marginLeft: "auto" },
  colBody: { flex: 1 },
  catGroup: { marginBottom: 14 },
  catLabel: { fontSize: 12, fontWeight: 600, color: "#8A8580", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: "#FFFFFF",
    borderRadius: 10,
    border: "1px solid #E8E4DF",
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  chipText: { lineHeight: 1.2 },
  chipDinners: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
  },
  chipMinus: {
    width: 22,
    height: 22,
    background: "#F0ECE7",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 700,
    color: "#8A8580",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
  },
  dinnerCount: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6B8F5E",
    minWidth: 20,
    textAlign: "center",
  },
  chipLow: {
    borderColor: "#E8C97A",
    background: "#FFFCF2",
  },
  chipSelected: {
    borderColor: "#D4856A",
    background: "#FFF3ED",
    boxShadow: "0 0 0 2px #D4856A",
  },
  chipX: {
    background: "none",
    border: "none",
    color: "#C9C2BA",
    fontSize: 13,
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    fontWeight: 600,
    borderRadius: 4,
  },
  emptyCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 120,
  },

  // ── Meal Plan ──
  mpRoot: { display: "flex", flexDirection: "column", gap: 16 },
  weekNav: { display: "flex", alignItems: "center", gap: 16, justifyContent: "center" },
  weekBtn: {
    width: 44, height: 44,
    border: "2px solid #E8E4DF",
    borderRadius: 10,
    background: "#fff",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Outfit',sans-serif",
    color: "#2D2A26",
  },
  weekCenter: { textAlign: "center" },
  weekLabel: { fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces',serif" },
  todayBtn: {
    marginTop: 4,
    padding: "4px 14px",
    border: "1.5px solid #D4856A",
    borderRadius: 6,
    background: "transparent",
    color: "#D4856A",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
  },

  // Auto-fill
  autoFill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "#FFF8EB",
    borderRadius: 12,
    border: "1.5px solid #F0D9A0",
    fontSize: 14,
  },
  autoFillYes: {
    padding: "6px 16px",
    background: "#6B8F5E",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
  },
  autoFillNo: {
    padding: "6px 16px",
    background: "transparent",
    color: "#8A8580",
    border: "1.5px solid #E8E4DF",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
  },

  // Meal grid
  mealGrid: {
    display: "grid",
    gridTemplateColumns: "100px 1fr 1fr",
    gap: 0,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #E8E4DF",
    overflow: "hidden",
  },
  gridHeaderCell: { padding: "14px 12px" },
  gridHeaderLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#8A8580",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "2px solid #E8E4DF",
    display: "flex",
    alignItems: "center",
  },
  dayCell: {
    padding: "14px 12px",
    borderTop: "1px solid #F0ECE7",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  dayCellToday: { background: "#FFF8EB" },
  dayDow: { fontSize: 14, fontWeight: 600 },
  dayDate: { fontSize: 12, color: "#8A8580" },
  mealCell: {
    padding: "8px",
    borderTop: "1px solid #F0ECE7",
    display: "flex",
    alignItems: "center",
  },
  mealCellToday: { background: "#FFFCF5" },
  mealCellEditing: { background: "#F5F1EB" },
  mealDisplay: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    transition: "background 0.12s",
  },
  mealEmpty: { color: "#C9C2BA", fontWeight: 400, fontStyle: "italic" },
  mealInput: {
    width: "100%",
    padding: "8px 12px",
    border: "2px solid #D4856A",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    background: "#fff",
    fontWeight: 500,
  },

  // Footer
  mpFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 4px",
  },
  mpHint: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#8A8580",
  },
  clearBtn: {
    padding: "6px 14px",
    background: "transparent",
    border: "1.5px solid #E8E4DF",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: "#B5AFA8",
    cursor: "pointer",
    fontFamily: "'Outfit',sans-serif",
  },
};
