import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, Plus } from "lucide-react";

export interface UnitOption {
  id: string;
  name: string;
  group: "weight" | "volume" | "packaging" | "portion";
}

export const PRESET_UNITS: UnitOption[] = [
  // Khối lượng
  { id: "g", name: "Gram (g)", group: "weight" },
  { id: "kg", name: "Kilogram (kg)", group: "weight" },
  { id: "mg", name: "Miligram (mg)", group: "weight" },
  { id: "oz", name: "Ounce (oz)", group: "weight" },

  // Thể tích
  { id: "ml", name: "Mililit (ml)", group: "volume" },
  { id: "l", name: "Lít (l)", group: "volume" },
  { id: "cl", name: "Centilit (cl)", group: "volume" },

  // Đóng gói / Bao bì
  { id: "lon", name: "Lon", group: "packaging" },
  { id: "hop", name: "Hộp", group: "packaging" },
  { id: "chai", name: "Chai", group: "packaging" },
  { id: "goi", name: "Gói / Bịch", group: "packaging" },
  { id: "tui", name: "Túi", group: "packaging" },
  { id: "bao", name: "Bao", group: "packaging" },
  { id: "thung", name: "Thùng", group: "packaging" },
  { id: "binh", name: "Bình", group: "packaging" },
  { id: "hu", name: "Hũ / Lọ", group: "packaging" },
  { id: "cay", name: "Cây / Ống", group: "packaging" },

  // Định lượng & Pha chế
  { id: "qua", name: "Quả / Trái", group: "portion" },
  { id: "lat", name: "Lát", group: "portion" },
  { id: "tep", name: "Tép / Nhánh", group: "portion" },
  { id: "la", name: "Lá", group: "portion" },
  { id: "vien", name: "Viên", group: "portion" },
  { id: "shot", name: "Shot espresso", group: "portion" },
  { id: "pump", name: "Pump siro", group: "portion" },
  { id: "muong", name: "Muỗng / Thìa", group: "portion" },
  { id: "ly", name: "Ly", group: "portion" },
  { id: "cai", name: "Cái", group: "portion" },
];

const GROUP_LABELS: Record<string, string> = {
  weight: "Khối lượng",
  volume: "Thể tích",
  packaging: "Đóng gói / Bao bì",
  portion: "Định lượng pha chế",
};

interface SearchableUnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  style?: React.CSSProperties;
}

export default function SearchableUnitSelect({
  value,
  onChange,
  style,
}: SearchableUnitSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredUnits = PRESET_UNITS.filter((u) => {
    return (
      u.id.toLowerCase().includes(normalizedSearch) ||
      u.name.toLowerCase().includes(normalizedSearch) ||
      GROUP_LABELS[u.group].toLowerCase().includes(normalizedSearch)
    );
  });

  const selectedItem = PRESET_UNITS.find((u) => u.id === value);
  const displayLabel = selectedItem ? selectedItem.name : value || "Chọn đơn vị";

  const isCustomMatch =
    normalizedSearch &&
    !PRESET_UNITS.some(
      (u) => u.id.toLowerCase() === normalizedSearch || u.name.toLowerCase() === normalizedSearch
    );

  function handleSelect(unitId: string) {
    onChange(unitId);
    setIsOpen(false);
    setSearch("");
  }

  function handleCustomSelect() {
    if (normalizedSearch) {
      onChange(search.trim());
      setIsOpen(false);
      setSearch("");
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: isOpen ? "1.5px solid #2D3E2F" : "1px solid #DFD9CE",
          borderRadius: 8,
          background: "#FFFFFF",
          color: value ? "#1E261F" : "#7A8A7C",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          outline: "none",
          textAlign: "left",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          transition: "all 0.15s ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayLabel}
        </span>
        <ChevronDown
          size={15}
          style={{
            color: "#607062",
            marginLeft: 6,
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            width: 260,
            maxWidth: "90vw",
            background: "#FFFFFF",
            border: "1px solid #DFD9CE",
            borderRadius: 10,
            boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
            zIndex: 1100,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Input Box */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #F0ECE4",
              background: "#FAF8F5",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Search size={14} style={{ color: "#7A8A7C" }} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm hoặc gõ đơn vị mới..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 12.5,
                color: "#1E261F",
                width: "100%",
              }}
            />
          </div>

          {/* Units List */}
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {/* Custom option if user types something new */}
            {isCustomMatch && (
              <div
                onClick={handleCustomSelect}
                style={{
                  padding: "8px 12px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#2D3E2F",
                  background: "#F2F7F2",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  borderBottom: "1px dashed #DFD9CE",
                }}
              >
                <Plus size={14} /> Dùng đơn vị tùy chỉnh: "{search.trim()}"
              </div>
            )}

            {filteredUnits.length === 0 && !isCustomMatch ? (
              <div style={{ padding: "14px 12px", fontSize: 12, color: "#8A968B", textAlign: "center" }}>
                Không tìm thấy đơn vị phù hợp
              </div>
            ) : (
              // Grouped items
              (["weight", "volume", "packaging", "portion"] as const).map((grp) => {
                const itemsInGrp = filteredUnits.filter((u) => u.group === grp);
                if (itemsInGrp.length === 0) return null;

                return (
                  <div key={grp}>
                    <div
                      style={{
                        padding: "6px 12px 2px",
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#7A8A7C",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                      }}
                    >
                      {GROUP_LABELS[grp]}
                    </div>
                    {itemsInGrp.map((u) => {
                      const isSelected = u.id === value;
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleSelect(u.id)}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#2D3E2F" : "#1E261F",
                            background: isSelected ? "#EBF4ED" : "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "background 0.1s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "#F9F8F6";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span>{u.name}</span>
                          {isSelected && <Check size={13} style={{ color: "#2D3E2F" }} />}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
