import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  Users,
  Building2,
  LayoutGrid,
  Network,
  Plus,
  FileDown,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  ArrowLeft,
  Settings,
  MapPin,
  Crosshair,
  X,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Circle,
  ChevronDown,
} from 'lucide-react';
import employeeService from '../../services/employeeService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import SidePanel from '../../components/ui/SidePanel';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import EmployeeForm from './EmployeeForm';
import EmployeeQuickAddPanel from './EmployeeQuickAddForm';

// Vite bundles Leaflet's marker images as hashed asset URLs — the library's
// default icon lookup assumes unbundled relative paths, so it must be
// overridden or markers render as broken images.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_MAP_CENTER = { lat: 41.2995, lng: 69.2401 }; // Tashkent
import useToast from '../../hooks/useToast';

const ORG_TABS = [
  { value: 'xodimlar', label: 'Xodimlar', icon: Users },
  { value: 'filiallar', label: 'Filiallar', icon: Building2 },
  { value: 'bolimlar', label: "Bo'limlar", icon: LayoutGrid },
  { value: 'lavozimlar', label: 'Lavozimlar', icon: Network },
];

// Chapga moslangan SidePanel'lar (Filial/Bo'lim/Lavozim qo'shish) uchun
// sarlavha oldidagi gradient ikon-belgi — SidePanel'ning o'ziga tegmasdan,
// uning "title" prop'i har qanday node'ni qabul qilgani uchun shu yerdan
// beriladi.
function PanelTitle({ icon, children }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 10px rgba(249, 115, 22, 0.3)',
        }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

function exportEmployeesToCsv(employees) {
  const headers = ['Ism', 'Familiya', "Bo'lim", 'Filial', 'Lavozim', 'Telefon', 'Email'];
  const rows = employees.map((e) => [
    e.first_name || '',
    e.last_name || '',
    e.department || '',
    e.branch || '',
    e.position || '',
    e.phone || '',
    e.email || '',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'xodimlar.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * BranchLocationPicker
 * Leaflet map for placing a branch's geofence: search an address (Nominatim),
 * drag/click the marker to fine-tune it, and a circle preview of the radius.
 */
export function BranchLocationPicker({ lat, lng, radius, address, onAddressChange, onPositionChange }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(address || '');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    const map = L.map(mapElRef.current, { zoomControl: false }).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onPositionChange(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      onPositionChange(e.latlng.lat, e.latlng.lng);
    });

    const circle = L.circle([lat, lng], {
      radius,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.15,
      weight: 1.5,
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // The modal can mount the map before it has final layout size.
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng]);
  }, [lat, lng]);

  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius || 0);
  }, [radius]);

  useEffect(() => {
    if (!mapRef.current) return;
    const timeout = setTimeout(() => mapRef.current.invalidateSize(), 200);
    return () => clearTimeout(timeout);
  }, [isExpanded]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`
      );
      const results = await res.json();
      if (results[0]) {
        onPositionChange(parseFloat(results[0].lat), parseFloat(results[0].lon));
        onAddressChange(results[0].display_name);
        setSearchQuery(results[0].display_name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      onPositionChange(pos.coords.latitude, pos.coords.longitude);
    });
  };

  return (
    <div className="org-map-wrapper">
      <div className="org-map-search">
        <Search size={15} />
        <input
          type="text"
          placeholder="Manzilni qidiring"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onAddressChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              onAddressChange('');
            }}
            title="Tozalash"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className={`org-map-container ${isExpanded ? 'expanded' : ''}`}>
        <div ref={mapElRef} className="org-map" />
        <button
          type="button"
          className="org-map-btn org-map-expand"
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? 'Kichraytirish' : 'Kattalashtirish'}
        >
          {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button
          type="button"
          className="org-map-btn org-map-locate"
          onClick={handleLocate}
          title="Joriy joylashuvim"
        >
          <Crosshair size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * SearchableSelect
 * Single-select dropdown with a search box and checkbox-style rows — reuses
 * the same "attendance-schedule-*" classes the Davomat page's picker uses,
 * so the Xodimlar filters (Filiallar/Lavozimlar/Bo'limlar) open the same way.
 */
function SearchableSelect({ options, selected, onChange, icon: Icon, placeholder, searchPlaceholder = 'Qidiruv' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((opt) => opt.value === selected)?.label;

  return (
    <div className="attendance-schedule-select org-filter-select" ref={wrapperRef}>
      <button
        type="button"
        className={`attendance-schedule-trigger ${isOpen ? 'open' : ''} ${selected ? 'filled' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={selectedLabel ? '' : 'placeholder'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="attendance-schedule-panel">
          <div className="attendance-schedule-search">
            <Search size={15} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="attendance-schedule-list">
            {filtered.map((opt) => {
              const isChecked = selected === opt.value;
              return (
                <label key={opt.value} className={`attendance-schedule-item ${isChecked ? 'checked' : ''}`}>
                  {Icon && <Icon size={16} className="attendance-schedule-item-icon" />}
                  <span>{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      onChange(isChecked ? '' : opt.value);
                      setIsOpen(false);
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * OrganizationPage
 * "Tashkilot tuzilmasi" — the Xodimlar tab reuses the real employee list
 * (search/filter/create/edit/delete all wired to the existing API).
 * Filiallar/Bo'limlar/Lavozimlar have no backend model yet, so those tabs
 * are placeholders.
 */
const ORG_TAB_VALUES = ORG_TABS.map((tab) => tab.value);

export function OrganizationPage() {
  const { toast } = useToast();

  // Kept in the URL (?tab=...) instead of plain useState so a page refresh
  // stays on the tab the user was looking at.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ORG_TAB_VALUES.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'xodimlar';
  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const [branches, setBranches] = useState([]);
  const [branchSearch, setBranchSearch] = useState('');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    radius: 50,
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
    verified: false,
  });

  const [departments, setDepartments] = useState([]);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleteDepartmentTarget, setDeleteDepartmentTarget] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '' });

  const [positions, setPositions] = useState([]);
  const [positionSearch, setPositionSearch] = useState('');
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [deletePositionTarget, setDeletePositionTarget] = useState(null);
  const [positionForm, setPositionForm] = useState({ name: '' });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const allEmployees = await employeeService.getAllEmployees();
      setEmployees(allEmployees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const branchOptions = useMemo(
    () => [...new Set(employees.map((e) => e.branch).filter(Boolean))],
    [employees]
  );
  const departmentOptions = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))],
    [employees]
  );
  const positionOptions = useMemo(
    () => [...new Set(employees.map((e) => e.position).filter(Boolean))],
    [employees]
  );

  // Seed the local Filiallar list from the branch names already present on
  // employees — there's no dedicated "branch" backend model yet, so this
  // list only lives in the browser.
  useEffect(() => {
    if (branches.length === 0 && branchOptions.length > 0) {
      setBranches(
        branchOptions.map((name, i) => ({ id: `seed-${i}`, name, address: '', radius: 50 }))
      );
    }
  }, [branchOptions, branches.length]);

  const filteredBranches = branches.filter((b) => {
    if (!branchSearch) return true;
    const q = branchSearch.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q);
  });

  const handleAddBranchClick = () => {
    setEditingBranch(null);
    setBranchForm({
      name: '',
      address: '',
      radius: 50,
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      verified: false,
    });
    setIsBranchModalOpen(true);
  };

  const handleEditBranchClick = (b) => {
    setEditingBranch(b);
    setBranchForm({
      name: b.name,
      address: b.address,
      radius: b.radius,
      lat: b.lat ?? DEFAULT_MAP_CENTER.lat,
      lng: b.lng ?? DEFAULT_MAP_CENTER.lng,
      verified: b.verified || false,
    });
    setIsBranchModalOpen(true);
  };

  const handleBranchModalClose = () => {
    setIsBranchModalOpen(false);
    setEditingBranch(null);
  };

  const handleBranchSave = () => {
    if (!branchForm.name.trim()) return;
    if (editingBranch) {
      setBranches((prev) =>
        prev.map((b) => (b.id === editingBranch.id ? { ...b, ...branchForm } : b))
      );
    } else {
      setBranches((prev) => [...prev, { id: `branch-${Date.now()}`, ...branchForm }]);
    }
    handleBranchModalClose();
  };

  const handleDeleteBranch = (id) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    setDeleteBranchTarget(null);
  };

  // Same idea as Filiallar — seeded once from the real department values,
  // then managed purely in the browser (no backend model for this yet).
  useEffect(() => {
    if (departments.length === 0 && departmentOptions.length > 0) {
      setDepartments(
        departmentOptions.map((name, i) => ({ id: `seed-${i}`, name }))
      );
    }
  }, [departmentOptions, departments.length]);

  const filteredDepartments = departments.filter((d) => {
    if (!departmentSearch) return true;
    return d.name.toLowerCase().includes(departmentSearch.toLowerCase());
  });

  const handleAddDepartmentClick = () => {
    setEditingDepartment(null);
    setDepartmentForm({ name: '' });
    setIsDepartmentModalOpen(true);
  };

  const handleEditDepartmentClick = (d) => {
    setEditingDepartment(d);
    setDepartmentForm({ name: d.name });
    setIsDepartmentModalOpen(true);
  };

  const handleDepartmentModalClose = () => {
    setIsDepartmentModalOpen(false);
    setEditingDepartment(null);
  };

  const handleDepartmentSave = () => {
    if (!departmentForm.name.trim()) return;
    if (editingDepartment) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === editingDepartment.id ? { ...d, ...departmentForm } : d))
      );
    } else {
      setDepartments((prev) => [...prev, { id: `department-${Date.now()}`, ...departmentForm }]);
    }
    handleDepartmentModalClose();
  };

  const handleDeleteDepartment = (id) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    setDeleteDepartmentTarget(null);
  };

  // Same idea as Filiallar/Bo'limlar — seeded once from the real position
  // values, then managed purely in the browser.
  useEffect(() => {
    if (positions.length === 0 && positionOptions.length > 0) {
      setPositions(
        positionOptions.map((name, i) => ({ id: `seed-${i}`, name }))
      );
    }
  }, [positionOptions, positions.length]);

  const filteredPositions = positions.filter((p) => {
    if (!positionSearch) return true;
    return p.name.toLowerCase().includes(positionSearch.toLowerCase());
  });

  const handleAddPositionClick = () => {
    setEditingPosition(null);
    setPositionForm({ name: '' });
    setIsPositionModalOpen(true);
  };

  const handleEditPositionClick = (p) => {
    setEditingPosition(p);
    setPositionForm({ name: p.name });
    setIsPositionModalOpen(true);
  };

  const handlePositionModalClose = () => {
    setIsPositionModalOpen(false);
    setEditingPosition(null);
  };

  const handlePositionSave = () => {
    if (!positionForm.name.trim()) return;
    if (editingPosition) {
      setPositions((prev) =>
        prev.map((p) => (p.id === editingPosition.id ? { ...p, ...positionForm } : p))
      );
    } else {
      setPositions((prev) => [...prev, { id: `position-${Date.now()}`, ...positionForm }]);
    }
    handlePositionModalClose();
  };

  const handleDeletePosition = (id) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    setDeletePositionTarget(null);
  };

  // "Xodim qo'shish/tahrirlash" formasi ichidagi "+" tugmalari uchun — o'z
  // mustaqil mini-panelida to'ldirilgan yangi filial/bo'lim/lavozimni shu
  // yerdagi ro'yxatlarga qo'shadi (Filiallar/Bo'limlar/Lavozimlar tabidagi
  // ro'yxat bilan bir xil holat, chunki ikkalasi ham shu state'ni ishlatadi).
  const handleCreateBranchFromQuickAdd = (newBranch) => {
    setBranches((prev) => [...prev, { id: `branch-${Date.now()}`, ...newBranch }]);
  };

  const handleCreateDepartmentFromQuickAdd = (newDepartment) => {
    setDepartments((prev) => [...prev, { id: `department-${Date.now()}`, ...newDepartment }]);
  };

  const handleCreatePositionFromQuickAdd = (newPosition) => {
    setPositions((prev) => [...prev, { id: `position-${Date.now()}`, ...newPosition }]);
  };

  const filteredEmployees = employees.filter((emp) => {
    if (branchFilter && emp.branch !== branchFilter) return false;
    if (departmentFilter && emp.department !== departmentFilter) return false;
    if (positionFilter && emp.position !== positionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      if (!fullName.includes(q)) return false;
    }
    return true;
  });

  const handleCreateClick = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (emp) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleQuickAddClose = () => {
    setIsQuickAddOpen(false);
    setEditingEmployee(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleFormSuccess = () => {
    handleModalClose();
    fetchEmployees();
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = async (id) => {
    try {
      // Backend arxivlash yoki haqiqiy o'chirishni o'zi tanlaydi (tarixi
      // bor xodim arxivlanadi) — xabarni o'shandan olamiz.
      const res = await employeeService.deleteEmployee(id);
      toast.success(res?.message || "Xodim ro'yxatdan olib tashlandi");
      fetchEmployees();
    } catch (err) {
      toast.error("Xodimni o'chirishda xatolik yuz berdi");
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="org-tabs-row">
        <div className="org-tabs">
          {ORG_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`org-tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              <tab.icon size={15} strokeWidth={2.25} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'xodimlar' && (
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={handleCreateClick}
          >
            Xodim qo'shish
          </Button>
        )}
        {activeTab === 'filiallar' && (
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={handleAddBranchClick}
          >
            Yangi filial qo'shish
          </Button>
        )}
        {activeTab === 'bolimlar' && (
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={handleAddDepartmentClick}
          >
            Yangi bo'lim
          </Button>
        )}
        {activeTab === 'lavozimlar' && (
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={handleAddPositionClick}
          >
            Lavozim qo'shish
          </Button>
        )}
      </div>

      {activeTab === 'filiallar' ? (
        <>
          <div className="org-toolbar">
            <h2 className="org-title">Filiallar</h2>
            <div className="org-toolbar-right">
              <div className="org-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Filial qidiruvi"
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card style={{ padding: 0 }}>
            {filteredBranches.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="Filiallar topilmadi"
                text="Hali birorta filial qo'shilmagan."
              />
            ) : (
              <>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Filial nomi</th>
                        <th>Manzil</th>
                        <th>Radius</th>
                        <th style={{ textAlign: 'right' }}>Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBranches.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <div className="attendance-employee-cell">
                              <div className="attendance-avatar-fallback">
                                <Building2 size={16} strokeWidth={2.25} />
                              </div>
                              <div className="attendance-employee-name">{b.name}</div>
                            </div>
                          </td>
                          <td>
                            <div className="attendance-branch-cell">
                              <MapPin size={14} strokeWidth={2.25} />
                              {b.address || 'Manzil kiritilmagan'}
                            </div>
                          </td>
                          <td>
                            <div className="attendance-branch-cell">
                              <Crosshair size={14} strokeWidth={2.25} />
                              {b.radius} metr
                            </div>
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="attendance-toggle-btn"
                                title="Tahrirlash"
                                onClick={() => handleEditBranchClick(b)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="attendance-toggle-btn"
                                title="O'chirish"
                                style={{ color: 'var(--error)' }}
                                onClick={() => setDeleteBranchTarget(b)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="attendance-table-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            )}
          </Card>
        </>
      ) : activeTab === 'bolimlar' ? (
        <>
          <div className="org-toolbar">
            <h2 className="org-title">Bo'limlar</h2>
            <div className="org-toolbar-right">
              <div className="org-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Bo'limlarni qidirish..."
                  value={departmentSearch}
                  onChange={(e) => setDepartmentSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card style={{ padding: '0.75rem' }} className="org-dept-card">
            {filteredDepartments.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title="Bo'limlar topilmadi"
                text="Hali birorta bo'lim qo'shilmagan."
              />
            ) : (
              <>
                <div className="org-dept-list">
                  {filteredDepartments.map((d) => (
                    <div key={d.id} className="org-dept-row">
                      <div className="org-dept-avatar">
                        <LayoutGrid size={18} strokeWidth={2.25} />
                      </div>
                      <div className="org-dept-name">
                        <span className="org-dept-name-main">{d.name}</span>
                        <span className="org-dept-name-suffix"> bo'limi</span>
                      </div>
                      <div className="org-dept-actions">
                        <button
                          type="button"
                          className="org-dept-btn edit"
                          title="Tahrirlash"
                          onClick={() => handleEditDepartmentClick(d)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="org-dept-btn delete"
                          title="O'chirish"
                          onClick={() => setDeleteDepartmentTarget(d)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="org-dept-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            )}
          </Card>
        </>
      ) : activeTab === 'lavozimlar' ? (
        <>
          <div className="org-toolbar">
            <h2 className="org-title">Lavozimlar</h2>
            <div className="org-toolbar-right">
              <div className="org-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Lavozimlarni qidirish..."
                  value={positionSearch}
                  onChange={(e) => setPositionSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card style={{ padding: 0 }}>
            {filteredPositions.length === 0 ? (
              <EmptyState
                icon="🧩"
                title="Lavozimlar topilmadi"
                text="Hali birorta lavozim qo'shilmagan."
              />
            ) : (
              <>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nomi</th>
                        <th style={{ textAlign: 'right' }}>Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPositions.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="attendance-employee-cell">
                              <div className="attendance-avatar-fallback">
                                <Network size={16} strokeWidth={2.25} />
                              </div>
                              <div className="attendance-employee-name">
                                <span className="org-pos-name-main">{p.name}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="attendance-toggle-btn"
                                title="Tahrirlash"
                                onClick={() => handleEditPositionClick(p)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="attendance-toggle-btn"
                                title="O'chirish"
                                style={{ color: 'var(--error)' }}
                                onClick={() => setDeletePositionTarget(p)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="attendance-table-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            )}
          </Card>
        </>
      ) : activeTab !== 'xodimlar' ? (
        <Card>
          <EmptyState
            icon="🏗️"
            title="Tez orada"
            text="Bu bo'lim hali ishlab chiqilmoqda."
          />
        </Card>
      ) : (
        <>
          <div className="org-toolbar">
            <h2 className="org-title">Xodimlar</h2>
            <div className="org-toolbar-right">
              <button
                type="button"
                className="org-export-btn"
                onClick={() => exportEmployeesToCsv(filteredEmployees)}
              >
                <FileDown size={15} strokeWidth={2.25} /> Excelni yuklab olish
              </button>
              <SearchableSelect
                options={branchOptions.map((b) => ({ value: b, label: b }))}
                selected={branchFilter}
                onChange={setBranchFilter}
                icon={Building2}
                placeholder="Filiallar"
              />
              <SearchableSelect
                options={positionOptions.map((p) => ({ value: p, label: p }))}
                selected={positionFilter}
                onChange={setPositionFilter}
                icon={Network}
                placeholder="Lavozimlar"
              />
              <SearchableSelect
                options={departmentOptions.map((d) => ({ value: d, label: d }))}
                selected={departmentFilter}
                onChange={setDepartmentFilter}
                icon={LayoutGrid}
                placeholder="Bo'limlar"
              />
              <div className="org-search">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Qidiruv"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card style={{ padding: 0 }}>
            {detailEmployee ? (
              <>
                <div className="attendance-detail-header">
                  <button
                    type="button"
                    className="attendance-toggle-btn"
                    onClick={() => setDetailEmployee(null)}
                    title="Orqaga"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="attendance-detail-title">
                      {detailEmployee.first_name} {detailEmployee.last_name}
                    </div>
                    <div className="attendance-detail-subtitle">
                      {format(new Date(), 'yyyy-MM-dd')} ga tegishli belgilar
                    </div>
                  </div>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vaqt</th>
                        <th>Faoliyat</th>
                        <th>Holati</th>
                        <th>Izohlar va Manzil</th>
                        <th>Manba</th>
                        <th>Tasdiqlash</th>
                      </tr>
                    </thead>
                  </table>
                </div>

                <EmptyState icon="📦" title="Belgilar topilmadi" text="" />

                <div className="attendance-table-footer">
                  <button type="button" className="attendance-toggle-btn" title="Ustunlar sozlamasi">
                    <Settings size={15} />
                  </button>
                </div>
              </>
            ) : loading ? (
              <LoadingSpinner text="Yuklanmoqda..." />
            ) : filteredEmployees.length === 0 ? (
              <EmptyState
                icon="👥"
                title="Xodimlar topilmadi"
                text="Qidiruv shartlariga mos xodim yo'q."
              />
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Xodim</th>
                      <th>Bo'lim</th>
                      <th>Filiallar</th>
                      <th></th>
                      <th>Jadval</th>
                      <th style={{ textAlign: 'right' }}>Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <div className="attendance-employee-cell">
                            {emp.photo_url ? (
                              <img
                                className="attendance-avatar"
                                src={employeeService.getPhotoUrl(emp.photo_url)}
                                alt={`${emp.first_name} ${emp.last_name}`}
                              />
                            ) : (
                              <div className="attendance-avatar-fallback">
                                {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                              </div>
                            )}
                            <div>
                              <div className="attendance-employee-name">
                                {emp.first_name} {emp.last_name}
                              </div>
                              {emp.position && (
                                <div className="attendance-employee-role">{emp.position}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{emp.department || '-'}</td>
                        <td>
                          <div className="attendance-branch-cell">
                            <Building2 size={14} strokeWidth={2.25} /> {emp.branch || '-'}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="attendance-toggle-btn"
                            title="Batafsil"
                            onClick={() => setDetailEmployee(emp)}
                          >
                            <ExternalLink size={14} />
                          </button>
                        </td>
                        <td>
                          <div className="org-schedule-cell">
                            <div>
                              <span className="org-schedule-time">8:00 - 18:00</span>
                              <span className="org-schedule-badge">Moslashuvchan</span>
                            </div>
                            <div className="org-schedule-meta">
                              <span><CalendarDays size={12} strokeWidth={2.25} /> 6/1</span>
                              <span><Clock size={12} strokeWidth={2.25} /> 08:00 - 18:00</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="attendance-toggle-btn"
                              title="Tahrirlash"
                              onClick={() => handleEditClick(emp)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="attendance-toggle-btn"
                              title="O'chirish"
                              style={{ color: 'var(--error)' }}
                              onClick={() => setDeleteTarget(emp)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <SidePanel
        isOpen={isBranchModalOpen}
        onClose={handleBranchModalClose}
        title={
          <PanelTitle icon={<Building2 size={17} strokeWidth={2.25} />}>
            {editingBranch ? 'Filialni tahrirlash' : "Yangi filial qo'shish"}
          </PanelTitle>
        }
        footer={
          <Button variant="primary" className="attendance-primary-btn" onClick={handleBranchSave}>
            Saqlash
          </Button>
        }
      >
        {/*
          XAVFSIZLIK-AUDIT.md (2-pass, Geolocation #5): bu butun forma —
          filial nomi, manzil, geofence (lat/lng/radius) — hozircha faqat
          shu sahifaning local state'ida yashaydi (setBranches), hech
          qanday backend'ga saqlanmaydi va davomat tekshiruvida hech
          qayerda ishlatilmaydi. "Saqlash" bosilgach sahifa yangilansa
          hammasi yo'qoladi. To'liq backend (branches jadvali + CRUD +
          attendance'ga bog'lash) alohida, kattaroq funksiya — bu audit
          topilmasi doirasida qurilmadi; hozircha faqat foydalanuvchini
          chalg'itmaslik uchun ogohlantirish qo'shildi.
        */}
        <p className="org-map-unsaved-note" style={{
          fontSize: '0.82rem',
          color: 'var(--warning, #b45309)',
          background: 'var(--warning-soft, #fdf3e3)',
          border: '1px solid var(--warning-line, #f0d3ac)',
          borderRadius: '8px',
          padding: '0.6rem 0.85rem',
          marginBottom: '1.2rem',
          lineHeight: 1.5,
        }}>
          ⚠️ Diqqat: bu filial ma'lumotlari (jumladan geofence) hozircha faqat shu sahifada, vaqtincha
          saqlanadi — backend'ga yozilmaydi va davomatni tekshirishda ishlatilmaydi. Sahifa yangilansa yo'qoladi.
        </p>
        <Input
          label="Filial nomi"
          name="branchName"
          value={branchForm.name}
          onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Filial nomi"
          className="mb-6"
          required
        />
        <div className="form-group mb-6">
          <label className="form-label">Manzil</label>
          <BranchLocationPicker
            lat={branchForm.lat}
            lng={branchForm.lng}
            radius={branchForm.radius}
            address={branchForm.address}
            onAddressChange={(address) => setBranchForm((prev) => ({ ...prev, address }))}
            onPositionChange={(lat, lng) => setBranchForm((prev) => ({ ...prev, lat, lng }))}
          />
        </div>
        <Input
          label="Radius (metr)"
          name="branchRadius"
          type="number"
          min="0"
          value={branchForm.radius}
          onChange={(e) => setBranchForm((prev) => ({ ...prev, radius: Number(e.target.value) }))}
          className="mb-6"
        />
        <button
          type="button"
          className="org-map-verify"
          onClick={() => setBranchForm((prev) => ({ ...prev, verified: !prev.verified }))}
        >
          <span>Joylashuvni tekshirish</span>
          {branchForm.verified ? (
            <CheckCircle2 size={20} style={{ color: '#f97316' }} />
          ) : (
            <Circle size={20} style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
      </SidePanel>

      <SidePanel
        isOpen={isDepartmentModalOpen}
        onClose={handleDepartmentModalClose}
        title={
          <PanelTitle icon={<LayoutGrid size={17} strokeWidth={2.25} />}>
            {editingDepartment ? "Bo'limni tahrirlash" : "Yangi bo'lim qo'shish"}
          </PanelTitle>
        }
        footer={
          <Button variant="primary" className="attendance-primary-btn" onClick={handleDepartmentSave}>
            Saqlash
          </Button>
        }
      >
        <Input
          label="Bo'lim nomi"
          name="departmentName"
          value={departmentForm.name}
          onChange={(e) => setDepartmentForm({ name: e.target.value })}
          placeholder="Bo'lim nomi"
          required
        />
      </SidePanel>

      <SidePanel
        isOpen={isPositionModalOpen}
        onClose={handlePositionModalClose}
        title={
          <PanelTitle icon={<Network size={17} strokeWidth={2.25} />}>
            {editingPosition ? 'Lavozimni tahrirlash' : "Yangi lavozim qo'shish"}
          </PanelTitle>
        }
        footer={
          <Button variant="primary" className="attendance-primary-btn" onClick={handlePositionSave}>
            Saqlash
          </Button>
        }
      >
        <Input
          label="Nomi"
          name="positionName"
          value={positionForm.name}
          onChange={(e) => setPositionForm({ name: e.target.value })}
          placeholder="Lavozim nomi"
          required
        />
      </SidePanel>

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={editingEmployee ? "Xodim ma'lumotlarini tahrirlash" : "Yangi xodim qo'shish"}
        size="lg"
      >
        <EmployeeForm
          employee={editingEmployee}
          onSubmitSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      <EmployeeQuickAddPanel
        isOpen={isQuickAddOpen}
        onClose={handleQuickAddClose}
        employee={editingEmployee}
        branches={branches}
        departments={departments}
        positions={positions}
        onCreateBranch={handleCreateBranchFromQuickAdd}
        onCreateDepartment={handleCreateDepartmentFromQuickAdd}
        onCreatePosition={handleCreatePositionFromQuickAdd}
      />

      {deletePositionTarget && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setDeletePositionTarget(null)}>
          <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="org-delete-icon">
              <Trash2 size={26} strokeWidth={1.5} />
              <span className="org-delete-icon-badge">
                <X size={12} strokeWidth={3} />
              </span>
            </div>
            <h3 className="org-delete-title">Lavozimni o'chirish</h3>
            <p className="org-delete-message">
              Ushbu lavozimni o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
            </p>
            <div className="org-delete-actions">
              <Button variant="primary" fullWidth onClick={() => setDeletePositionTarget(null)}>
                Bekor qilish
              </Button>
              <Button variant="outline" fullWidth onClick={() => handleDeletePosition(deletePositionTarget.id)}>
                O'chirish
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteDepartmentTarget && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setDeleteDepartmentTarget(null)}>
          <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="org-delete-icon">
              <Trash2 size={26} strokeWidth={1.5} />
              <span className="org-delete-icon-badge">
                <X size={12} strokeWidth={3} />
              </span>
            </div>
            <h3 className="org-delete-title">Bo'limni o'chirish</h3>
            <p className="org-delete-message">
              Bu bo'limni o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
            </p>
            <div className="org-delete-actions">
              <Button variant="primary" fullWidth onClick={() => setDeleteDepartmentTarget(null)}>
                Bekor qilish
              </Button>
              <Button variant="outline" fullWidth onClick={() => handleDeleteDepartment(deleteDepartmentTarget.id)}>
                O'chirish
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteBranchTarget && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setDeleteBranchTarget(null)}>
          <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="org-delete-icon">
              <Trash2 size={26} strokeWidth={1.5} />
              <span className="org-delete-icon-badge">
                <X size={12} strokeWidth={3} />
              </span>
            </div>
            <h3 className="org-delete-title">Filialni o'chirish</h3>
            <p className="org-delete-message">Bu filialni o'chirishni xohlaysizmi?</p>
            <div className="org-delete-actions">
              <Button variant="primary" fullWidth onClick={() => setDeleteBranchTarget(null)}>
                Bekor qilish
              </Button>
              <Button variant="outline" fullWidth onClick={() => handleDeleteBranch(deleteBranchTarget.id)}>
                O'chirish
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteTarget && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="org-delete-icon">
              <Trash2 size={26} strokeWidth={1.5} />
              <span className="org-delete-icon-badge">
                <X size={12} strokeWidth={3} />
              </span>
            </div>
            <h3 className="org-delete-title">Xodimni o'chirish</h3>
            <p className="org-delete-message">
              Haqiqatan ham <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong>ni butunlay
              o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.
            </p>
            <div className="org-delete-actions">
              <Button variant="primary" fullWidth onClick={() => setDeleteTarget(null)}>
                Bekor qilish
              </Button>
              <Button variant="outline" fullWidth onClick={() => handleDelete(deleteTarget.id)}>
                O'chirish
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default OrganizationPage;
