"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FlavorItem, SyncResult } from "@/lib/types";
import { LOCATIONS, getLocationById, getLocationColor } from "@/lib/locations";
import CalendarPreview from "./calendar-preview";

interface Props {
  onLogout: () => void;
}

type ChangeMap = Record<string, "create" | "update" | "delete">;

let tempIdCounter = 0;
function tempId() {
  return `_new_${Date.now()}_${tempIdCounter++}`;
}

function formatDateForInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toISODate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00Z").toISOString();
}

export default function Dashboard({ onLogout }: Props) {
  const [items, setItems] = useState<FlavorItem[]>([]);
  const [originalItems, setOriginalItems] = useState<FlavorItem[]>([]);
  const [changes, setChanges] = useState<ChangeMap>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [activeLocations, setActiveLocations] = useState<Set<string>>(
    new Set(LOCATIONS.map((l) => l.id))
  );

  // New flavor form state
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<string>(LOCATIONS[0].id);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flavors");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const sorted = data.items.sort((a: FlavorItem, b: FlavorItem) => {
        const da = a.startDate || "";
        const db = b.startDate || "";
        return da.localeCompare(db);
      });
      setItems(sorted);
      setOriginalItems(JSON.parse(JSON.stringify(sorted)));
      setChanges({});
    } catch {
      showToast("Failed to load flavors from Webflow", "error");
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const changeCount = Object.keys(changes).length;

  function updateItem(id: string, field: keyof FlavorItem, value: string | boolean) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Auto-set className when location changes
        if (field === "locationId") {
          const loc = getLocationById(value as string);
          if (loc) updated.className = loc.className;
        }
        return updated;
      })
    );

    // Track change
    if (!changes[id]) {
      const isNew = id.startsWith("_new_");
      setChanges((prev) => ({ ...prev, [id]: isNew ? "create" : "update" }));
    }
  }

  function deleteItem(id: string) {
    const isNew = id.startsWith("_new_");
    if (isNew) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setChanges((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setChanges((prev) => {
        if (prev[id] === "delete") {
          // Undo delete - restore from original
          const next = { ...prev };
          delete next[id];
          const orig = originalItems.find((i) => i.id === id);
          if (orig) {
            setItems((prevItems) => prevItems.map((i) => (i.id === id ? { ...orig } : i)));
          }
          return next;
        }
        return { ...prev, [id]: "delete" };
      });
    }
  }

  function undoChange(id: string) {
    const isNew = id.startsWith("_new_");
    if (isNew) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      const orig = originalItems.find((i) => i.id === id);
      if (orig) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...orig } : i)));
      }
    }
    setChanges((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addFlavor() {
    if (!newName.trim() || !newStartDate) {
      showToast("Please fill in at least name and start date", "error");
      return;
    }

    const id = tempId();
    const loc = getLocationById(newLocation);
    const newItem: FlavorItem = {
      id,
      name: newName.trim(),
      slug: "",
      locationId: newLocation,
      startDate: toISODate(newStartDate),
      endDate: toISODate(newEndDate || newStartDate),
      className: loc?.className || "",
      allDay: true,
      isDraft: false,
      isArchived: false,
      lastPublished: null,
    };

    setItems((prev) => [newItem, ...prev]);
    setChanges((prev) => ({ ...prev, [id]: "create" }));

    setNewName("");
    setNewStartDate("");
    setNewEndDate("");
    showToast(`Added "${newItem.name}" - remember to Sync!`, "success");
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    const creates = Object.entries(changes)
      .filter(([, type]) => type === "create")
      .map(([id]) => items.find((i) => i.id === id)!)
      .filter(Boolean);

    const updates = Object.entries(changes)
      .filter(([, type]) => type === "update")
      .map(([id]) => items.find((i) => i.id === id)!)
      .filter(Boolean);

    const deletes = Object.entries(changes)
      .filter(([, type]) => type === "delete")
      .map(([id]) => id);

    try {
      const res = await fetch("/api/flavors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creates, updates, deletes }),
      });

      const result: SyncResult = await res.json();
      setSyncResult(result);

      if (result.errors.length === 0) {
        showToast(
          `Synced! ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
          "success"
        );
        setShowSyncModal(false);
        await fetchItems();
      } else {
        showToast(`Sync completed with ${result.errors.length} error(s)`, "error");
      }
    } catch {
      showToast("Sync failed - check your connection", "error");
    }

    setSyncing(false);
  }

  function toggleLocation(id: string) {
    setActiveLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterLocation !== "all" && item.locationId !== filterLocation) return false;
      if (!activeLocations.has(item.locationId)) return false;
      if (filterSearch && !item.name.toLowerCase().includes(filterSearch.toLowerCase()))
        return false;
      return true;
    });
  }, [items, filterLocation, filterSearch, activeLocations]);

  const calendarEvents = useMemo(() => {
    return items
      .filter((item) => activeLocations.has(item.locationId) && changes[item.id] !== "delete")
      .map((item) => {
        const loc = getLocationById(item.locationId);
        // FullCalendar end date is exclusive for all-day events, so add 1 day
        let endDate = item.endDate;
        if (endDate) {
          const d = new Date(endDate);
          d.setDate(d.getDate() + 1);
          endDate = d.toISOString();
        }
        return {
          id: item.id,
          title: item.name,
          start: item.startDate,
          end: endDate || item.startDate,
          allDay: true,
          backgroundColor: loc?.color || "#666",
          borderColor: loc?.color || "#666",
        };
      });
  }, [items, activeLocations, changes]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: "center" }}>
          <div className="loading-spinner-lg" />
          <p>Loading flavors from Webflow...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <h1>Anderson&apos;s Flavor Calendar</h1>
        <div className="header-actions">
          {changeCount > 0 && <span className="sync-badge">{changeCount} pending</span>}
          <button
            className="btn btn-success"
            onClick={() => setShowSyncModal(true)}
            disabled={changeCount === 0}
          >
            Sync to Webflow
          </button>
          <button className="btn btn-outline btn-sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Location filter pills */}
        <div className="location-pills">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              className={`location-pill ${activeLocations.has(loc.id) ? "active" : ""}`}
              style={{ backgroundColor: loc.color }}
              onClick={() => toggleLocation(loc.id)}
            >
              {loc.name}
            </button>
          ))}
        </div>

        {/* Calendar preview */}
        <div className="panel calendar-panel">
          <div className="panel-header">
            <h2>Calendar Preview</h2>
          </div>
          <div className="panel-body">
            <CalendarPreview events={calendarEvents} />
          </div>
        </div>

        {/* Table editor */}
        <div className="panel">
          <div className="panel-header">
            <h2>
              Flavor List{" "}
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                ({filteredItems.length} items)
              </span>
            </h2>
            <button className="btn btn-outline btn-sm" onClick={fetchItems}>
              Refresh
            </button>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            >
              <option value="all">All Locations</option>
              {LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search flavors..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="flavor-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Flavor Name</th>
                  <th>Location</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">No flavors match your filters</div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const changeType = changes[item.id];
                    const rowClass = changeType === "create"
                      ? "new-item"
                      : changeType === "delete"
                      ? "deleted"
                      : changeType === "update"
                      ? "changed"
                      : "";

                    return (
                      <tr key={item.id} className={rowClass}>
                        <td>
                          <span
                            className="location-dot"
                            style={{ backgroundColor: getLocationColor(item.locationId) }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, "name", e.target.value)}
                            disabled={changeType === "delete"}
                          />
                        </td>
                        <td>
                          <select
                            value={item.locationId}
                            onChange={(e) => updateItem(item.id, "locationId", e.target.value)}
                            disabled={changeType === "delete"}
                          >
                            {LOCATIONS.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={formatDateForInput(item.startDate)}
                            onChange={(e) =>
                              updateItem(item.id, "startDate", toISODate(e.target.value))
                            }
                            disabled={changeType === "delete"}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={formatDateForInput(item.endDate)}
                            onChange={(e) =>
                              updateItem(item.id, "endDate", toISODate(e.target.value))
                            }
                            disabled={changeType === "delete"}
                          />
                        </td>
                        <td>
                          <div className="table-actions">
                            {changeType && (
                              <button
                                className="icon-btn"
                                title="Undo change"
                                onClick={() => undoChange(item.id)}
                              >
                                ↩
                              </button>
                            )}
                            <button
                              className="icon-btn danger"
                              title={changeType === "delete" ? "Undo delete" : "Delete"}
                              onClick={() => deleteItem(item.id)}
                            >
                              {changeType === "delete" ? "↩" : "✕"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add flavor form */}
          <div className="add-form">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Flavor Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Chocolate Peanut Butter"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Location</label>
              <select value={newLocation} onChange={(e) => setNewLocation(e.target.value)}>
                {LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={addFlavor}>
              + Add Flavor
            </button>
          </div>
        </div>
      </div>

      {/* Sync confirmation modal */}
      {showSyncModal && (
        <div className="modal-overlay" onClick={() => !syncing && setShowSyncModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sync Changes to Webflow</h3>
            </div>
            <div className="modal-body">
              {syncResult && syncResult.errors.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ color: "var(--danger)", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Errors:
                  </p>
                  {syncResult.errors.map((err, i) => (
                    <p key={i} style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
                      {err}
                    </p>
                  ))}
                </div>
              )}

              <p style={{ marginBottom: "0.75rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                The following changes will be pushed to the live website:
              </p>

              <ul className="change-list">
                {Object.entries(changes).map(([id, type]) => {
                  const item = type === "delete"
                    ? originalItems.find((i) => i.id === id) || items.find((i) => i.id === id)
                    : items.find((i) => i.id === id);
                  if (!item) return null;
                  const loc = getLocationById(item.locationId);
                  return (
                    <li key={id} className={`change-item ${type}`}>
                      <span className="change-badge">{type}</span>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      <span style={{ color: loc?.color, fontSize: "0.8rem" }}>
                        {loc?.name}
                      </span>
                      {item.startDate && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {formatDateForInput(item.startDate)}
                          {item.endDate && item.endDate !== item.startDate
                            ? ` to ${formatDateForInput(item.endDate)}`
                            : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowSyncModal(false)}
                disabled={syncing}
              >
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <span className="spinner" /> Syncing...
                  </>
                ) : (
                  `Push ${changeCount} Change${changeCount !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}
